import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/ingredient.dart';
import '../services/api_service.dart';

class AddIngredientSheet extends StatefulWidget {
  const AddIngredientSheet({super.key, required this.initialStorageType});
  final String initialStorageType;

  @override
  State<AddIngredientSheet> createState() => _AddIngredientSheetState();
}

class _AddIngredientSheetState extends State<AddIngredientSheet> {
  final _nameController = TextEditingController();
  final _nameFocus = FocusNode();
  late String _storageType;
  DateTime _expireDate = DateTime.now().add(const Duration(days: 7));
  bool _saving = false;
  static const _types = {'FRIDGE': '냉장', 'FREEZER': '냉동', 'ROOM': '실온'};

  @override
  void initState() {
    super.initState();
    _storageType = widget.initialStorageType;
    WidgetsBinding.instance.addPostFrameCallback((_) => _nameFocus.requestFocus());
  }

  @override
  void dispose() { _nameController.dispose(); _nameFocus.dispose(); super.dispose(); }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(context: context, initialDate: _expireDate, firstDate: DateTime(now.year - 1), lastDate: DateTime(now.year + 10), locale: const Locale('ko', 'KR'));
    if (picked != null) setState(() => _expireDate = picked);
  }

  Future<void> _save() async {
    if (_saving) return;
    final name = _nameController.text.trim();
    if (name.isEmpty) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('식재료 이름을 입력해주세요'))); return; }
    setState(() => _saving = true);
    try {
      final item = await ApiService.instance.addIngredient(name: name, storageType: _storageType, expireDate: _expireDate);
      if (mounted) Navigator.pop(context, item);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('등록에 실패했어요: $error')));
    } finally { if (mounted) setState(() => _saving = false); }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(child: Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)))),
        const SizedBox(height: 20), const Text('식재료 등록', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 18),
        TextField(controller: _nameController, focusNode: _nameFocus, textInputAction: TextInputAction.done, onSubmitted: (_) => _save(), decoration: const InputDecoration(labelText: '식재료명', hintText: '예: 계란', border: OutlineInputBorder())),
        const SizedBox(height: 18), const Text('보관 장소', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8), Wrap(spacing: 8, children: _types.entries.map((entry) => ChoiceChip(label: Text(entry.value), selected: _storageType == entry.key, onSelected: (_) => setState(() => _storageType = entry.key))).toList()),
        const SizedBox(height: 14), OutlinedButton.icon(onPressed: _pickDate, icon: const Icon(Icons.calendar_month), label: Text('유통기한  ${DateFormat('yyyy-MM-dd').format(_expireDate)}')),
        const SizedBox(height: 18), FilledButton(onPressed: _saving ? null : _save, child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('등록하기')),
      ])),
    ));
  }
}
