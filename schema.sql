CREATE DATABASE IF NOT EXISTS clean_plate_today CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clean_plate_today;

CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  nickname VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  ingredient_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  storage_type ENUM('FRIDGE','FREEZER','ROOM') NOT NULL,
  expire_date DATE NOT NULL,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ingredient_id),
  KEY idx_ingredients_user_consumed_expire (user_id, is_consumed, expire_date),
  CONSTRAINT fk_ingredients_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seed_recipes (
  recipe_id INT NOT NULL AUTO_INCREMENT,
  keyword VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  ingredients_text TEXT NOT NULL,
  instructions TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  PRIMARY KEY (recipe_id),
  KEY idx_seed_recipes_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (user_id, nickname) VALUES (1, '자취생')
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname);

INSERT INTO seed_recipes (keyword,title,ingredients_text,instructions,image_url) VALUES
('계란','전자레인지 계란찜','계란 2개, 물 100ml, 소금 약간, 대파 약간','1. 계란과 물, 소금을 그릇에 풀어요. 2. 대파를 넣고 뚜껑을 살짝 덮어요. 3. 전자레인지에서 2분 익히고 부족하면 30초씩 더 익혀요.',NULL),
('두부','간장 두부조림','두부 1/2모, 간장 1큰술, 물 3큰술, 고춧가루 1/2큰술, 대파 약간','1. 두부를 썰어 팬에 구워요. 2. 간장, 물, 고춧가루를 섞어 부어요. 3. 대파를 넣고 5분 정도 졸여요.',NULL),
('대파','대파 계란볶음밥','밥 1공기, 계란 1개, 대파 1/2대, 간장 1큰술','1. 대파를 썰어 기름에 볶아요. 2. 계란을 넣어 익힌 뒤 밥을 넣어요. 3. 간장을 둘러 2분 더 볶아요.',NULL),
('양파','양파 간장덮밥','밥 1공기, 양파 1/2개, 간장 1큰술, 설탕 1작은술, 물 3큰술, 계란 1개','1. 양파를 얇게 썰어 볶아요. 2. 간장, 설탕, 물을 넣고 부드러워질 때까지 끓여요. 3. 계란을 넣어 익히고 밥 위에 올려요.',NULL),
('김치','간단 김치볶음밥','밥 1공기, 김치 1/2컵, 대파 약간, 간장 1작은술','1. 김치와 대파를 썰어요. 2. 기름에 3분 볶아요. 3. 밥과 간장을 넣어 고루 볶아요.',NULL),
('스팸','스팸 계란덮밥','밥 1공기, 스팸 1/4캔, 계란 1개, 간장 1작은술','1. 스팸을 작게 썰어 노릇하게 구워요. 2. 계란을 넣어 스크램블해요. 3. 밥에 올리고 간장을 조금 뿌려요.',NULL),
('감자','전자레인지 감자조림','감자 1개, 간장 1큰술, 물 3큰술, 설탕 1작은술, 참기름 약간','1. 감자를 작게 썰어 그릇에 담아요. 2. 간장, 물, 설탕을 섞어 붓고 뚜껑을 살짝 덮어요. 3. 전자레인지에서 4분 익히고 참기름을 넣어요.',NULL),
('애호박','애호박 볶음밥','밥 1공기, 애호박 1/3개, 계란 1개, 소금 약간','1. 애호박을 잘게 썰어 3분 볶아요. 2. 계란을 넣어 익혀요. 3. 밥과 소금을 넣고 볶아요.',NULL),
('참치','참치 마요 덮밥','밥 1공기, 참치 1/2캔, 마요네즈 1큰술, 간장 1작은술, 김가루 약간','1. 참치 기름을 빼고 밥에 올려요. 2. 간장과 마요네즈를 뿌려요. 3. 김가루를 얹어요.',NULL),
('우유','초간단 우유 크림 파스타','파스타면 1인분, 우유 200ml, 마늘 1쪽, 소금과 후추 약간','1. 파스타면을 삶아요. 2. 마늘을 볶고 우유를 부어 약불로 끓여요. 3. 면을 넣고 간해 2분 섞어요.',NULL);
