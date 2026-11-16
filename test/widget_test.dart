import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:clean_plate_today/widgets/add_ingredient_sheet.dart';

void main() {
  testWidgets(
    'Ingredient form uses selected storage and validates blank name',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AddIngredientSheet(initialStorageType: 'FREEZER'),
          ),
        ),
      );
      await tester.pump();
      final selected = tester
          .widgetList<ChoiceChip>(find.byType(ChoiceChip))
          .where((chip) => chip.selected)
          .single;
      expect((selected.label as Text).data, '냉동');
      await tester.ensureVisible(find.text('등록하기'));
      await tester.tap(find.text('등록하기'));
      await tester.pump();
      expect(find.text('식재료 이름을 입력해주세요'), findsOneWidget);
    },
  );
}
