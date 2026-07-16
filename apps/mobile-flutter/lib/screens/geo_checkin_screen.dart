import 'package:flutter/material.dart';
import '../database/geo_checkin_db.dart';

class GeoCheckInScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;
  const GeoCheckInScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<GeoCheckInScreen> createState() => _GeoCheckInScreenState();
}

class _GeoCheckInScreenState extends State<GeoCheckInScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  bool _isCheckedIn = false;
  DateTime? _checkInTime;
  String? _currentCheckInId;

  Future<void> _checkIn() async {
    final now = DateTime.now();
    final checkInId = 'geo-chk-${now.millisecondsSinceEpoch}';

    final newRecord = {
      'id': checkInId,
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'outletId': 'outlet-uuid-999',
      'visitId': 'visit-uuid-888',
      'checkInTime': now,
      'checkOutTime': null,
      'checkInLat': 28.6139,
      'checkInLng': 77.2090,
      'checkOutLat': null,
      'checkOutLng': null,
      'distanceFromOutlet': 12.5,
      'isWithinGeofence': true,
      'spoofingDetected': false,
      'deviceInfo': {'model': 'Pixel 8', 'os': 'Android 14', 'batteryLevel': 90},
      'version': 1,
      'syncStatus': 'pending_insert',
    };

    setState(() {
      _localCache.add(newRecord);
      _isCheckedIn = true;
      _checkInTime = now;
      _currentCheckInId = checkInId;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Geofenced Check-In successful (saved locally)')),
    );
  }

  Future<void> _checkOut() async {
    if (_checkInTime == null || _currentCheckInId == null) return;

    final now = DateTime.now();
    final elapsed = now.difference(_checkInTime!);

    // Business rule: minimum 2 minutes duration
    if (elapsed.inMinutes < 2) {
      final secondsLeft = 120 - elapsed.inSeconds;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Check-Out Blocked'),
          content: Text('Minimum visit duration is 2 minutes. Please wait another $secondsLeft seconds.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    final index = _localCache.indexWhere((r) => r['id'] == _currentCheckInId);
    if (index != -1) {
      setState(() {
        _localCache[index]['checkOutTime'] = now;
        _localCache[index]['checkOutLat'] = 28.6139;
        _localCache[index]['checkOutLng'] = 77.2090;
        _localCache[index]['syncStatus'] = 'pending_update';
        _localCache[index]['version'] += 1;
        _isCheckedIn = false;
        _checkInTime = null;
        _currentCheckInId = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Geofenced Check-Out successful (saved locally)')),
      );
    }
  }

  Future<void> _syncData() async {
    if (!_isOnline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot sync: Offline mode active')),
      );
      return;
    }

    setState(() {
      for (var record in _localCache) {
        record['syncStatus'] = 'synced';
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('GeoCheckIn sync completed successfully!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Geofenced Check-In'),
        actions: [
          IconButton(
            icon: Icon(_isOnline ? Icons.wifi : Icons.wifi_off),
            color: _isOnline ? Colors.green : Colors.red,
            onPressed: () {
              setState(() {
                _isOnline = !_isOnline;
              });
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              color: Colors.blueGrey[900],
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Icon(Icons.location_on, size: 48, color: Colors.blue),
                    const SizedBox(height: 12),
                    const Text(
                      'GEOFENCE STATUS',
                      style: TextStyle(fontSize: 14, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isCheckedIn ? 'CHECKED IN' : 'NOT CHECKED IN',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: _isCheckedIn ? Colors.green : Colors.red,
                      ),
                    ),
                    if (_checkInTime != null) ...[
                      const SizedBox(height: 8),
                      Text('Check-in Time: ${_checkInTime!.toLocal().toString().substring(11, 19)}'),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (!_isCheckedIn) ...[
              ElevatedButton.icon(
                icon: const Icon(Icons.login),
                label: const Text('CHECK IN AT OUTLET'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: _checkIn,
              ),
            ] else ...[
              ElevatedButton.icon(
                icon: const Icon(Icons.logout),
                label: const Text('CHECK OUT FROM OUTLET'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: _checkOut,
              ),
            ],
            const Spacer(),
            ElevatedButton.icon(
              icon: const Icon(Icons.sync),
              label: const Text('SYNC CACHE'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: _syncData,
            ),
          ],
        ),
      ),
    );
  }
}
