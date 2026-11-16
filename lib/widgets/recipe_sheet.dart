import 'package:flutter/material.dart';
import '../models/recipe.dart';

class RecipeSheet extends StatelessWidget {
  const RecipeSheet({super.key, required this.recipes, required this.ingredientName});
  final List<Recipe> recipes;
  final String ingredientName;

  @override
  Widget build(BuildContext context) {
    return SafeArea(child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)))),
        const SizedBox(height: 18), Text('$ingredientName 1인분 레시피', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (recipes.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('추천 레시피가 없어요.'))
        else Flexible(child: ListView.separated(shrinkWrap: true, itemCount: recipes.length, separatorBuilder: (_, __) => const Divider(height: 24), itemBuilder: (context, index) => _RecipeCard(recipe: recipes[index]))),
      ]),
    ));
  }
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({required this.recipe});
  final Recipe recipe;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(recipe.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      const SizedBox(height: 10),
      if (recipe.imageUrl != null && recipe.imageUrl!.isNotEmpty)
        ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(recipe.imageUrl!, height: 170, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _imagePlaceholder()))
      else _imagePlaceholder(),
      const SizedBox(height: 12), const Text('필요 재료', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 4), Text(recipe.ingredients),
      const SizedBox(height: 12), const Text('조리 순서', style: TextStyle(fontWeight: FontWeight.bold)),
      const SizedBox(height: 4), Text(recipe.instructions.isEmpty ? '조리 순서 정보가 없어요.' : recipe.instructions),
      if (recipe.isFallback) const Padding(padding: EdgeInsets.only(top: 8), child: Text('기본 추천 레시피', style: TextStyle(color: Colors.black54, fontSize: 12))),
    ]);
  }

  Widget _imagePlaceholder() => Container(height: 150, width: double.infinity, decoration: BoxDecoration(color: Colors.green.withOpacity(0.08), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.restaurant, size: 48, color: Colors.black38));
}
