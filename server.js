require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

function dDay(value) {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  const expiry = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / 86400000);
}

const storageTypes = ['FRIDGE', 'FREEZER', 'ROOM'];

app.post('/api/ingredients', async (req, res) => {
  const { userId, name, storageType, expireDate } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name은 공백일 수 없습니다.' });
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) return res.status(400).json({ error: '유효한 userId가 필요합니다.' });
  if (!storageTypes.includes(storageType)) return res.status(400).json({ error: '유효하지 않은 storageType입니다.' });
  if (typeof expireDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate) || Number.isNaN(Date.parse(`${expireDate}T00:00:00Z`))) return res.status(400).json({ error: 'expireDate는 YYYY-MM-DD 형식이어야 합니다.' });
  try {
    const [result] = await pool.execute('INSERT INTO ingredients (user_id,name,storage_type,expire_date) VALUES (?,?,?,?)', [Number(userId), name.trim(), storageType, expireDate]);
    const [rows] = await pool.execute('SELECT ingredient_id,user_id,name,storage_type,expire_date,is_consumed,created_at FROM ingredients WHERE ingredient_id=?', [result.insertId]);
    return res.status(201).json({ ...rows[0], dDay: dDay(rows[0].expire_date) });
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: '존재하지 않는 userId입니다.' });
    console.error(error);
    return res.status(500).json({ error: '식재료를 생성하지 못했습니다.' });
  }
});

app.get('/api/ingredients', async (req, res) => {
  const { userId, storageType } = req.query;
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) return res.status(400).json({ error: '유효한 userId가 필요합니다.' });
  if (storageType !== undefined && !storageTypes.includes(storageType)) return res.status(400).json({ error: '유효하지 않은 storageType입니다.' });
  try {
    let sql = 'SELECT ingredient_id,user_id,name,storage_type,expire_date,is_consumed,created_at FROM ingredients WHERE user_id=? AND is_consumed=FALSE';
    const params = [Number(userId)];
    if (storageType) { sql += ' AND storage_type=?'; params.push(storageType); }
    sql += ' ORDER BY expire_date ASC';
    const [rows] = await pool.execute(sql, params);
    return res.json(rows.map(row => ({ ...row, dDay: dDay(row.expire_date) })));
  } catch (error) { console.error(error); return res.status(500).json({ error: '식재료를 조회하지 못했습니다.' }); }
});

app.patch('/api/ingredients/:id/consume', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '유효한 식재료 id가 필요합니다.' });
  try {
    const [rows] = await pool.execute('SELECT name FROM ingredients WHERE ingredient_id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: '식재료를 찾을 수 없습니다.' });
    await pool.execute('UPDATE ingredients SET is_consumed=TRUE WHERE ingredient_id=?', [id]);
    return res.json({ isConsumed: true, repurchaseUrl: `https://www.coupang.com/np/search?q=${encodeURIComponent(rows[0].name)}` });
  } catch (error) { console.error(error); return res.status(500).json({ error: '식재료를 처리하지 못했습니다.' }); }
});

app.delete('/api/ingredients/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '유효한 식재료 id가 필요합니다.' });
  try {
    const [result] = await pool.execute('DELETE FROM ingredients WHERE ingredient_id=?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: '식재료를 찾을 수 없습니다.' });
    return res.json({ deleted: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: '식재료를 삭제하지 못했습니다.' }); }
});

async function fallbackRecipes(ingredient) {
  let [rows] = ingredient ? await pool.execute('SELECT title,ingredients_text,instructions,image_url FROM seed_recipes WHERE keyword LIKE ? ORDER BY recipe_id', [`%${ingredient}%`]) : [[]];
  if (!rows.length) [rows] = await pool.query('SELECT title,ingredients_text,instructions,image_url FROM seed_recipes ORDER BY RAND() LIMIT 3');
  return rows.map(row => ({ title: row.title, ingredients: row.ingredients_text, instructions: row.instructions, imageUrl: row.image_url, isFallback: true }));
}

function mapMfdsRecipe(row) {
  const instructions = [];
  for (let i = 1; i <= 20; i += 1) {
    const value = row[`MANUAL${String(i).padStart(2, '0')}`];
    if (typeof value === 'string' && value.trim()) instructions.push(value.trim());
  }
  return { title: row.RCP_NM || '', ingredients: row.RCP_PARTS_DTLS || '', instructions: instructions.join('\n'), imageUrl: row.ATT_FILE_NO_MAIN || null, isFallback: false };
}

app.get('/api/recipes/recommend', async (req, res) => {
  const ingredient = typeof req.query.ingredient === 'string' ? req.query.ingredient.trim() : '';
  if (!ingredient) return res.status(400).json({ error: 'ingredient query가 필요합니다.' });
  try {
    if (process.env.MFDS_API_KEY) {
      const url = `http://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(process.env.MFDS_API_KEY)}/COOKRCP01/json/1/5/RCP_PARTS_DTLS=${encodeURIComponent(ingredient)}`;
      const response = await axios.get(url, { timeout: 2000 });
      const rows = response.data?.COOKRCP01?.row;
      if (Array.isArray(rows) && rows.length) return res.json(rows.map(mapMfdsRecipe));
    }
    return res.json(await fallbackRecipes(ingredient));
  } catch (error) {
    try { return res.json(await fallbackRecipes(ingredient)); }
    catch (fallbackError) { console.error(fallbackError); return res.status(500).json({ error: '레시피를 조회하지 못했습니다.' }); }
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
