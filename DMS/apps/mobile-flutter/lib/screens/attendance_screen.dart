import 'package:flutter/material.dart';

class AttendanceScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;
  const AttendanceScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  // In-memory representation of local cache store
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _currentStatus = 'absent';
  DateTime? _checkInTime;
  DateTime? _checkOutTime;

  @override
  void initState() {
    super.initState();
    _loadFromLocalCache();
  }

  void _loadFromLocalCache() {
    // Simulated reading from SQLite / Drift
    final today = DateTime.now().toString().substring(0, 10);
    final record = _localCache.firstWhere(
      (r) => r['date'] == today && r['tenantId'] == widget.tenantId,
      orElse: () => {},
    );

    if (record.isNotEmpty) {
      setState(() {
        _currentStatus = record['status'];
        _checkInTime = record['checkInTime'];
        _checkOutTime = record['checkOutTime'];
      });
    } else {
      setState(() {
        _currentStatus = 'absent';
        _checkInTime = null;
        _checkOutTime = null;
      });
    }
  }

  Future<void> _checkIn() async {
    final today = DateTime.now().toString().substring(0, 10);
    final now = DateTime.now();

    final newRecord = {
      'id': 'att-${now.millisecondsSinceEpoch}',
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'date': today,
      'checkInTime': now,
      'checkOutTime': null,
      'status': 'checked_in',
      'leaveType': null,
      'version': 1,
      'syncStatus': 'pending_insert',
    };

    setState(() {
      _localCache.add(newRecord);
      _currentStatus = 'checked_in';
      _checkInTime = now;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Checked In successfully (saved locally)')),
    );
  }

  Future<void> _checkOut() async {
    if (_checkInTime == null) return;

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

    final today = DateTime.now().toString().substring(0, 10);
    final index = _localCache.indexWhere((r) => r['date'] == today);

    if (index != -1) {
      setState(() {
        _localCache[index]['checkOutTime'] = now;
        _localCache[index]['status'] = 'checked_out';
        _localCache[index]['syncStatus'] = 'pending_update';
        _localCache[index]['version'] += 1;
        _currentStatus = 'checked_out';
        _checkOutTime = now;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked Out successfully (saved locally)')),
      );
    }
  }

  Future<void> _applyLeave(String leaveType) async {
    final today = DateTime.now().toString().substring(0, 10);
    final now = DateTime.now();

    final newRecord = {
      'id': 'att-${now.millisecondsSinceEpoch}',
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'date': today,
      'checkInTime': null,
      'checkOutTime': null,
      'status': 'leave',
      'leaveType': leaveType,
      'version': 1,
      'syncStatus': 'pending_insert',
    };

    setState(() {
      _localCache.add(newRecord);
      _currentStatus = 'leave';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Applied leave: $leaveType (saved locally)')),
    );
  }

  Future<void> _syncData() async {
    if (!_isOnline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot sync: Offline mode active')),
      );
      return;
    }

    setState(() {
      // Simulate conflict resolution and sync
      for (var record in _localCache) {
        record['syncStatus'] = 'synced';
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sync successful! Local cache synchronized with Server.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance Management'),
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
        key: const Key('attendance_body'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              color: Colors.blueGrey[900],
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text(
                      'CURRENT STATUS',
                      style: TextStyle(fontSize: 14, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _currentStatus.toUpperCase(),
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: _currentStatus == 'checked_in'
                            ? Colors.green
                            : _currentStatus == 'checked_out'
                                ? Colors.blue
                                : _currentStatus == 'leave'
                                    ? Colors.orange
                                    : Colors.red,
                      ),
                    ),
                    if (_checkInTime != null) ...[
                      const SizedBox(height: 8),
                      Text('Checked In: ${_checkInTime!.toLocal().toString().substring(11, 19)}'),
                    ],
                    if (_checkOutTime != null) ...[
                      const SizedBox(height: 4),
                      Text('Checked Out: ${_checkOutTime!.toLocal().toString().substring(11, 19)}'),
                    ]
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (_currentStatus == 'absent') ...[
              ElevatedButton.icon(
                icon: const Icon(Icons.login),
                label: const Text('CHECK IN'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: _checkIn,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.time_to_leave),
                label: const Text('APPLY CASUAL LEAVE'),
                onPressed: () => _applyLeave('Casual Leave'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.sick),
                label: const Text('APPLY SICK LEAVE'),
                onPressed: () => _applyLeave('Sick Leave'),
              ),
            ],
            if (_currentStatus == 'checked_in') ...[
              ElevatedButton.icon(
                icon: const Icon(Icons.logout),
                label: const Text('CHECK OUT'),
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
              label: const Text('SYNC LOCAL CACHE'),
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
