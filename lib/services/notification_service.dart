import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;
import '../models/ingredient.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    tz_data.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Seoul'));
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );
    await _plugin.initialize(settings);
    await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
    await _plugin.resolvePlatformSpecificImplementation<DarwinFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, badge: true, sound: true);
    _initialized = true;
  }

  Future<void> scheduleFor(Ingredient ingredient) async {
    final expiry = ingredient.expireDate;
    for (final daysBefore in [3, 1]) {
      final day = DateTime(expiry.year, expiry.month, expiry.day).subtract(Duration(days: daysBefore));
      final scheduled = tz.TZDateTime(tz.local, day.year, day.month, day.day, 10);
      if (!scheduled.isAfter(tz.TZDateTime.now(tz.local))) continue;
      await _plugin.zonedSchedule(
        ingredient.id * 10 + daysBefore,
        '유통기한이 다가와요',
        '${ingredient.name} 유통기한이 ${daysBefore}일 남았어요.',
        scheduled,
        const NotificationDetails(
          android: AndroidNotificationDetails('expiry_reminders', '유통기한 알림', channelDescription: '식재료 유통기한 알림', importance: Importance.high, priority: Priority.high),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      );
    }
  }

  Future<void> cancelFor(int ingredientId) async {
    await _plugin.cancel(ingredientId * 10 + 3);
    await _plugin.cancel(ingredientId * 10 + 1);
  }
}
