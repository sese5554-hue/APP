import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/ingredient.dart';
import '../models/recipe.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
import '../widgets/add_ingredient_sheet.dart';
import '../widgets/recipe_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _storageTypes = const ['FRIDGE', 'FREEZER', 'ROOM'];
  final _labels = const ['냉장', '냉동', '실온'];
  List<Ingredient> _items = [];
  bool _loading = true;
  String? _error;
  int _selectedIndex = 0;
  int _loadVersion = 0;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this)..addListener(_onTabChanged);
    _load();
  }

  @override
  void dispose() {
    _tabs.removeListener(_onTabChanged);
    _tabs.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_selectedIndex != _tabs.index) {
      _selectedIndex = _tabs.index;
      _load();
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    final version = ++_loadVersion;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ApiService.instance.getIngredients(
        _storageTypes[_tabs.index],
      );
      if (mounted && version == _loadVersion)
        setState(() {
          _items = result;
          _loading = false;
        });
    } on DioException catch (error) {
      if (mounted && version == _loadVersion)
        setState(() {
          _error = error.message ?? '서버에 연결할 수 없어요.';
          _loading = false;
        });
    } catch (_) {
      if (mounted && version == _loadVersion)
        setState(() {
          _error = '식재료를 불러오지 못했어요.';
          _loading = false;
        });
    }
  }

  Future<void> _add() async {
    final item = await showModalBottomSheet<Ingredient>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) =>
          AddIngredientSheet(initialStorageType: _storageTypes[_tabs.index]),
    );
    if (item == null || !mounted) return;
    try {
      await NotificationService.instance.scheduleFor(item);
    } catch (_) {
      if (mounted) _message('알림 예약에 실패했어요.');
    }
    await _load();
  }

  Future<void> _delete(Ingredient item) async {
    try {
      await ApiService.instance.deleteIngredient(item.id);
      await NotificationService.instance.cancelFor(item.id);
      if (mounted) _message('${item.name}을(를) 삭제했어요.');
    } catch (_) {
      if (mounted) _message('삭제하지 못했어요. 목록을 새로고침합니다.');
    }
    await _load();
  }

  Future<void> _consume(Ingredient item) async {
    setState(() => _items.removeWhere((value) => value.id == item.id));
    try {
      final url = await ApiService.instance.consumeIngredient(item.id);
      await NotificationService.instance.cancelFor(item.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${item.name} 다 드셨네요! 최저가로 바로 채워둘까요?'),
          action: SnackBarAction(label: '채우기', onPressed: () => _openUrl(url)),
        ),
      );
    } catch (_) {
      if (mounted) _message('완식 처리에 실패했어요.');
    }
    await _load();
  }

  Future<void> _openUrl(String value) async {
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) _message('구매 페이지를 열지 못했어요.');
    }
  }

  Future<void> _showRecipes(Ingredient item) async {
    try {
      final List<Recipe> recipes = await ApiService.instance.recommendRecipes(
        item.name,
      );
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => FractionallySizedBox(
          heightFactor: 0.82,
          child: RecipeSheet(recipes: recipes, ingredientName: item.name),
        ),
      );
    } catch (_) {
      if (mounted) _message('레시피를 불러오지 못했어요.');
    }
  }

  void _message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  String _ddayText(int value) {
    if (value > 0) return 'D-$value';
    if (value == 0) return 'D-Day';
    return 'D+${value.abs()}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 24,
        title: const Row(
          children: [
            CircleAvatar(
              backgroundColor: Color(0xFF285B43),
              foregroundColor: Color(0xFFF3ECCF),
              child: Icon(Icons.spa_outlined),
            ),
            SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CLEAN PLATE TODAY',
                  style: TextStyle(
                    fontSize: 8,
                    letterSpacing: 1.6,
                    color: Color(0xFF7D897A),
                  ),
                ),
                Text(
                  '오늘도 완식',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: RefreshIndicator(
            onRefresh: _load,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _kitchenHeader()),
                SliverToBoxAdapter(
                  child: TabBar(
                    controller: _tabs,
                    tabs: const [
                      Tab(
                        icon: Icon(Icons.kitchen_outlined, size: 20),
                        text: '냉장',
                      ),
                      Tab(icon: Icon(Icons.ac_unit, size: 20), text: '냉동'),
                      Tab(
                        icon: Icon(Icons.cottage_outlined, size: 20),
                        text: '실온',
                      ),
                    ],
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                  sliver: _ingredientSliver(),
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: const Color(0xFF285B43),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('식재료 등록'),
      ),
    );
  }

  Widget _kitchenHeader() {
    final available = !_loading && _error == null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 30, 24, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'MY LITTLE KITCHEN',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 2,
              color: Color(0xFF788966),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            '잘 챙겨 먹는 하루의 시작,',
            style: TextStyle(
              fontSize: 23,
              fontWeight: FontWeight.w700,
              letterSpacing: -1,
            ),
          ),
          const Text(
            '오늘도 완식.',
            style: TextStyle(
              fontSize: 35,
              height: 1.5,
              fontWeight: FontWeight.w800,
              letterSpacing: -1.6,
              color: Color(0xFF285B43),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            '잊고 있던 재료가 근사한 한 끼가 되도록.\n내 냉장고에서 오늘의 맛있는 가능성을 찾아보세요.',
            style: TextStyle(
              fontSize: 12,
              height: 1.9,
              color: Color(0xFF7D8479),
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFEFEFE5),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _stat(
                    Icons.kitchen_outlined,
                    '보관 중인 재료',
                    available ? '${_items.length}개' : '—',
                  ),
                ),
                Container(width: 1, height: 40, color: const Color(0xFFDADFCC)),
                const SizedBox(width: 20),
                Expanded(
                  child: _stat(
                    Icons.schedule,
                    '3일 이내 임박',
                    available
                        ? '${_items.where((item) => item.dDay >= 0 && item.dDay <= 3).length}개'
                        : '—',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Row(
            children: [
              const Expanded(
                child: Text(
                  '나의 냉장고',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                  ),
                ),
              ),
              Text(
                '${_labels[_selectedIndex]} 보관',
                style: const TextStyle(fontSize: 12, color: Color(0xFF7D8479)),
              ),
              IconButton(
                onPressed: _load,
                tooltip: '새로고침',
                icon: const Icon(Icons.refresh, size: 20),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(IconData icon, String label, String value) => Row(
    children: [
      Icon(icon, size: 23, color: const Color(0xFF6D8154)),
      const SizedBox(width: 10),
      Flexible(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 10, color: Color(0xFF78816E)),
            ),
            Text(
              value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: Color(0xFF354D38),
              ),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _ingredientSliver() {
    if (_loading)
      return const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    if (_error != null)
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Icon(
                Icons.cloud_off_outlined,
                size: 36,
                color: Color(0xFF88937C),
              ),
              const SizedBox(height: 14),
              const Text(
                '냉장고를 불러오지 못했어요',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text('연결 상태를 확인하고 다시 시도해주세요.', textAlign: TextAlign.center),
              const SizedBox(height: 18),
              FilledButton(onPressed: _load, child: const Text('다시 시도')),
            ],
          ),
        ),
      );
    if (_items.isEmpty)
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            children: [
              Icon(
                Icons.kitchen_outlined,
                size: 54,
                color: Colors.green.shade300,
              ),
              const SizedBox(height: 15),
              const Text(
                '냉장고가 비어있어요!',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text(
                '첫 재료를 등록하고 신선하게 관리해보세요.',
                style: TextStyle(fontSize: 12, color: Color(0xFF7D8479)),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: _add,
                icon: const Icon(Icons.add),
                label: const Text('식재료 등록하기'),
              ),
            ],
          ),
        ),
      );
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _ingredientCard(_items[index]),
        ),
        childCount: _items.length,
      ),
    );
  }

  Widget _ingredientCard(Ingredient item) {
    final expired = item.dDay < 0;
    final dueSoon = item.dDay >= 0;
    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 22),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) {
        setState(() => _items.removeWhere((value) => value.id == item.id));
        _delete(item);
      },
      child: Card(
        elevation: 0,
        color: const Color(0xFFFFFEFA),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE6E7DE)),
        ),
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: expired
                          ? Colors.red.shade100
                          : Colors.green.shade50,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _ddayText(item.dDay),
                      style: TextStyle(
                        color: expired
                            ? Colors.red.shade800
                            : Colors.green.shade800,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '유통기한  ${DateFormat('yyyy-MM-dd').format(item.expireDate)}',
                style: const TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 10),
              const Divider(),
              Wrap(
                alignment: WrapAlignment.end,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 4,
                children: [
                  IconButton(
                    onPressed: () => _delete(item),
                    tooltip: '${item.name} 삭제',
                    icon: const Icon(
                      Icons.delete_outline,
                      size: 19,
                      color: Color(0xFF929A89),
                    ),
                  ),
                  if (dueSoon)
                    TextButton.icon(
                      onPressed: () => _showRecipes(item),
                      icon: const Icon(Icons.restaurant_menu, size: 17),
                      label: const Text('1인분 레시피'),
                    ),
                  TextButton.icon(
                    onPressed: () => _consume(item),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text('완식'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
