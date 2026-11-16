class Ingredient {
  const Ingredient({
    required this.id,
    required this.userId,
    required this.name,
    required this.storageType,
    required this.expireDate,
    required this.dDay,
  });

  final int id;
  final int userId;
  final String name;
  final String storageType;
  final DateTime expireDate;
  final int dDay;

  factory Ingredient.fromJson(Map<String, dynamic> json) {
    return Ingredient(
      id: (json['ingredient_id'] as num).toInt(),
      userId: (json['user_id'] as num).toInt(),
      name: json['name'] as String,
      storageType: json['storage_type'] as String,
      expireDate: DateTime.parse(json['expire_date'].toString().substring(0, 10)),
      dDay: (json['dDay'] as num).toInt(),
    );
  }
}
