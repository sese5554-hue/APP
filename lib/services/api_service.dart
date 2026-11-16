import 'package:dio/dio.dart';
import '../models/ingredient.dart';
import '../models/recipe.dart';

class ApiService {
  ApiService._() : _dio = Dio(BaseOptions(baseUrl: const String.fromEnvironment('API_BASE_URL', defaultValue: baseUrl), connectTimeout: const Duration(seconds: 5), receiveTimeout: const Duration(seconds: 5)));
  static const String baseUrl = 'http://10.0.2.2:3000';
  static final ApiService instance = ApiService._();
  final Dio _dio;

  Future<List<Ingredient>> getIngredients(String storageType) async {
    final response = await _dio.get('/api/ingredients', queryParameters: {'userId': 1, 'storageType': storageType});
    return (response.data as List).map((item) => Ingredient.fromJson(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<Ingredient> addIngredient({required String name, required String storageType, required DateTime expireDate}) async {
    final date = '${expireDate.year.toString().padLeft(4, '0')}-${expireDate.month.toString().padLeft(2, '0')}-${expireDate.day.toString().padLeft(2, '0')}';
    final response = await _dio.post('/api/ingredients', data: {'userId': 1, 'name': name, 'storageType': storageType, 'expireDate': date});
    return Ingredient.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<void> deleteIngredient(int id) async => _dio.delete('/api/ingredients/$id');

  Future<String> consumeIngredient(int id) async {
    final response = await _dio.patch('/api/ingredients/$id/consume');
    return response.data['repurchaseUrl'] as String;
  }

  Future<List<Recipe>> recommendRecipes(String ingredient) async {
    final response = await _dio.get('/api/recipes/recommend', queryParameters: {'ingredient': ingredient});
    return (response.data as List).map((item) => Recipe.fromJson(Map<String, dynamic>.from(item as Map))).toList();
  }
}
