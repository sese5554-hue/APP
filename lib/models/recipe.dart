class Recipe {
  const Recipe({required this.title, required this.ingredients, required this.instructions, this.imageUrl, this.isFallback = false});

  final String title;
  final String ingredients;
  final String instructions;
  final String? imageUrl;
  final bool isFallback;

  factory Recipe.fromJson(Map<String, dynamic> json) => Recipe(
        title: (json['title'] ?? '').toString(),
        ingredients: (json['ingredients'] ?? '').toString(),
        instructions: (json['instructions'] ?? '').toString(),
        imageUrl: json['imageUrl'] as String?,
        isFallback: json['isFallback'] == true,
      );
}
