import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:typed_data';
import '../database/merchandising_audit_db.dart';

class MerchandisingAuditScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const MerchandisingAuditScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<MerchandisingAuditScreen> createState() => _MerchandisingAuditScreenState();
}

class _MerchandisingAuditScreenState extends State<MerchandisingAuditScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchQuery = '';
  String _statusFilter = 'all';

  // Encryption key (mock 32-byte key for AES-GCM cipher)
  final Uint8List _encryptionKey = Uint8List.fromList(
    List.generate(32, (index) => index + 20),
  );
  late final EncryptedMerchandisingAuditCache _cipherCache;

  final _formKey = GlobalKey<FormState>();
  final _outletIdController = TextEditingController();
  final _auditDateController = TextEditingController();
  final _planogramComplianceController = TextEditingController();
  final _displayScoreController = TextEditingController();
  final _notesController = TextEditingController();

  final _updateFormKey = GlobalKey<FormState>();
  final _updatePlanogramController = TextEditingController();
  final _updateDisplayScoreController = TextEditingController();
  final _updateNotesController = TextEditingController();
  String _updateSelectedStatus = 'DRAFT';

  @override
  void initState() {
    super.initState();
    _cipherCache = EncryptedMerchandisingAuditCache(_encryptionKey);
    _seedInitialData();
  }

  void _seedInitialData() {
    final encryptedFields = _cipherCache.encryptFields(notes: 'Display near entrance looks great');
    _localCache.add({
      'id': 'audit-001',
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'outletId': 'outlet-uuid-123',
      'visitId': null,
      'auditDate': '2026-07-19',
      'shelfPhotosJson': json.encode([
        {'photoUrl': 'http://images.com/shelf1.png', 'category': 'shelf', 'timestamp': DateTime.now().toIso8601String()},
      ]),
      'planogramCompliance': 85,
      'shelfShareByBrandJson': json.encode([
        {'brand': 'Coca-Cola', 'percentage': 40},
        {'brand': 'Pepsi', 'percentage': 30},
      ]),
      'outOfStockSkusJson': json.encode(['sku-101']),
      'pricingAuditJson': json.encode([
        {'skuId': 'sku-101', 'listedPrice': 100, 'actualPrice': 120},
      ]),
      'displayScore': 90,
      'notes': encryptedFields['notes'],
      'status': 'DRAFT',
      'version': 1,
      'syncStatus': 'synced',
      'createdAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
    });
  }

  String? _getDecryptedNotes(dynamic encryptedNotes) {
    if (encryptedNotes == null) return null;
    try {
      final decrypted = _cipherCache.decryptFields(encryptedNotes: encryptedNotes as String);
      return decrypted['notes'];
    } catch (_) {
      return 'Decryption Failed';
    }
  }

  /// State machine validation: only DRAFT → SUBMITTED is allowed for agents
  bool _canSubmit(String currentStatus) {
    return currentStatus == 'DRAFT';
  }

  void _showCreateDialog() {
    _outletIdController.text = 'outlet-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    _auditDateController.text = DateTime.now().toIso8601String().substring(0, 10);
    _planogramComplianceController.text = '80';
    _displayScoreController.text = '85';
    _notesController.clear();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Merchandising Audit'),
        content: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _outletIdController,
                  decoration: const InputDecoration(labelText: 'Outlet ID *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'Outlet ID required' : null,
                ),
                TextFormField(
                  controller: _auditDateController,
                  decoration: const InputDecoration(labelText: 'Audit Date (YYYY-MM-DD) *'),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Audit date required';
                    final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
                    if (!dateRegex.hasMatch(val)) return 'Format: YYYY-MM-DD';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _planogramComplianceController,
                  decoration: const InputDecoration(labelText: 'Planogram Compliance (0-100) *'),
                  keyboardType: TextInputType.number,
                  validator: (val) {
                    final num = int.tryParse(val ?? '');
                    if (num == null || num < 0 || num > 100) return 'Must be 0-100';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _displayScoreController,
                  decoration: const InputDecoration(labelText: 'Display Score (0-100) *'),
                  keyboardType: TextInputType.number,
                  validator: (val) {
                    final num = int.tryParse(val ?? '');
                    if (num == null || num < 0 || num > 100) return 'Must be 0-100';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(labelText: 'Notes (optional, encrypted at rest)'),
                  maxLines: 3,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (_formKey.currentState!.validate()) {
                final Map<String, dynamic> encryptedFields = {};
                if (_notesController.text.isNotEmpty) {
                  final encrypted = _cipherCache.encryptFields(notes: _notesController.text);
                  encryptedFields['notes'] = encrypted['notes'];
                }

                setState(() {
                  _localCache.add({
                    'id': 'audit-${DateTime.now().millisecondsSinceEpoch}',
                    'tenantId': widget.tenantId,
                    'agentId': widget.agentId,
                    'outletId': _outletIdController.text,
                    'visitId': null,
                    'auditDate': _auditDateController.text,
                    'shelfPhotosJson': json.encode([]),
                    'planogramCompliance': int.parse(_planogramComplianceController.text),
                    'shelfShareByBrandJson': json.encode([]),
                    'outOfStockSkusJson': json.encode([]),
                    'pricingAuditJson': json.encode([]),
                    'displayScore': int.parse(_displayScoreController.text),
                    'notes': encryptedFields['notes'],
                    'status': 'DRAFT',
                    'version': 1,
                    'syncStatus': _isOnline ? 'synced' : 'pending_insert',
                    'createdAt': DateTime.now().toIso8601String(),
                  });
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(_isOnline ? 'Audit created & synced' : 'Saved offline in queue')),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showUpdateDialog(Map<String, dynamic> item) {
    final currentStatus = item['status'] as String;
    final decryptedNotes = _getDecryptedNotes(item['notes']);

    _updatePlanogramController.text = item['planogramCompliance'].toString();
    _updateDisplayScoreController.text = item['displayScore'].toString();
    _updateNotesController.text = decryptedNotes ?? '';
    _updateSelectedStatus = currentStatus;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Update Merchandising Audit'),
          content: SingleChildScrollView(
            child: Form(
              key: _updateFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _updatePlanogramController,
                    decoration: const InputDecoration(labelText: 'Planogram Compliance (0-100)'),
                    keyboardType: TextInputType.number,
                    enabled: currentStatus == 'DRAFT',
                    validator: (val) {
                      final num = int.tryParse(val ?? '');
                      if (num == null || num < 0 || num > 100) return 'Must be 0-100';
                      return null;
                    },
                  ),
                  TextFormField(
                    controller: _updateDisplayScoreController,
                    decoration: const InputDecoration(labelText: 'Display Score (0-100)'),
                    keyboardType: TextInputType.number,
                    enabled: currentStatus == 'DRAFT',
                    validator: (val) {
                      final num = int.tryParse(val ?? '');
                      if (num == null || num < 0 || num > 100) return 'Must be 0-100';
                      return null;
                    },
                  ),
                  TextFormField(
                    controller: _updateNotesController,
                    decoration: const InputDecoration(labelText: 'Notes (encrypted at rest)'),
                    maxLines: 3,
                    enabled: currentStatus == 'DRAFT',
                  ),
                  const SizedBox(height: 10),
                  if (_canSubmit(currentStatus))
                    ElevatedButton.icon(
                      icon: const Icon(Icons.send),
                      label: const Text('Submit for Approval'),
                      onPressed: () {
                        setDialogState(() {
                          _updateSelectedStatus = 'SUBMITTED';
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  if (currentStatus != 'DRAFT')
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Status: $currentStatus — mutations are locked.',
                        style: const TextStyle(fontStyle: FontStyle.italic),
                      ),
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (_updateFormKey.currentState!.validate()) {
                  // State machine guard: only DRAFT -> SUBMITTED is valid for agents
                  if (_updateSelectedStatus == 'SUBMITTED' && currentStatus != 'DRAFT') {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Cannot submit — audit is not in DRAFT status')),
                    );
                    return;
                  }

                  final Map<String, dynamic> encryptedFields = {};
                  if (_updateNotesController.text.isNotEmpty) {
                    final encrypted = _cipherCache.encryptFields(notes: _updateNotesController.text);
                    encryptedFields['notes'] = encrypted['notes'];
                  }

                  setState(() {
                    if (currentStatus == 'DRAFT') {
                      item['planogramCompliance'] = int.parse(_updatePlanogramController.text);
                      item['displayScore'] = int.parse(_updateDisplayScoreController.text);
                      item['notes'] = encryptedFields['notes'] ?? item['notes'];
                    }
                    if (_updateSelectedStatus == 'SUBMITTED') {
                      item['status'] = 'SUBMITTED';
                    }

                    if (item['syncStatus'] == 'synced') {
                      item['syncStatus'] = 'pending_update';
                    }
                  });
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        _updateSelectedStatus == 'SUBMITTED'
                            ? 'Audit submitted for approval'
                            : 'Audit updated locally',
                      ),
                    ),
                  );
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _triggerSync() {
    int synced = 0;
    int conflicts = 0;

    setState(() {
      for (final item in _localCache) {
        if (item['syncStatus'] == 'pending_insert' || item['syncStatus'] == 'pending_update') {
          // Simulate sync conflict resolution: server version wins
          // In a real implementation, compare server version > local version
          item['syncStatus'] = 'synced';
          item['version'] = (item['version'] as int) + 1;
          synced++;
        }
      }
      // Remove tombstoned items after sync
      _localCache.removeWhere((item) => item['syncStatus'] == 'tombstone');
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sync complete: $synced item(s) synced, $conflicts conflict(s) resolved.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredAudits = _localCache.where((c) {
      final outletId = c['outletId'].toString().toLowerCase();
      final matchesSearch = outletId.contains(_searchQuery.toLowerCase()) ||
          c['auditDate'].toString().contains(_searchQuery);
      final matchesStatus = _statusFilter == 'all' || c['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Merchandising Audits (Offline-First)'),
        actions: [
          Row(
            children: [
              Text(_isOnline ? 'Online' : 'Offline', style: const TextStyle(fontSize: 14)),
              Switch(
                value: _isOnline,
                onChanged: (val) {
                  setState(() {
                    _isOnline = val;
                  });
                },
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: _isOnline ? _triggerSync : null,
            tooltip: _isOnline ? 'Sync Now' : 'Go online to sync',
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search by Outlet ID or Audit Date',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildFilterButton('All', 'all'),
              _buildFilterButton('DRAFT', 'DRAFT'),
              _buildFilterButton('SUBMITTED', 'SUBMITTED'),
              _buildFilterButton('APPROVED', 'APPROVED'),
              _buildFilterButton('REJECTED', 'REJECTED'),
            ],
          ),
          Expanded(
            child: filteredAudits.isEmpty
                ? const Center(child: Text('No audits found. Tap + to create one.'))
                : ListView.builder(
                    itemCount: filteredAudits.length,
                    itemBuilder: (ctx, index) {
                      final item = filteredAudits[index];
                      final decryptedNotes = _getDecryptedNotes(item['notes']);
                      final isPending = item['syncStatus'] != 'synced';
                      final oosSkus = (json.decode(item['outOfStockSkusJson'] as String) as List).length;
                      final shelfPhotos = (json.decode(item['shelfPhotosJson'] as String) as List).length;

                      return Card(
                        color: isPending ? Colors.orange.shade50 : null,
                        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: ListTile(
                          title: Text('Outlet: ${item['outletId']} — ${item['auditDate']}'),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Planogram: ${item['planogramCompliance']}% | Display: ${item['displayScore']}%'),
                              Text('Photos: $shelfPhotos | OOS SKUs: $oosSkus'),
                              if (decryptedNotes != null && decryptedNotes.isNotEmpty)
                                Text('Notes: $decryptedNotes (Decrypted)', style: const TextStyle(fontStyle: FontStyle.italic)),
                              Text(
                                'Sync: ${item['syncStatus']} | v${item['version']}',
                                style: TextStyle(
                                  color: isPending ? Colors.orange.shade800 : Colors.grey,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusColor(item['status'] as String),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              item['status'] as String,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                          ),
                          onTap: () => _showUpdateDialog(item),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'DRAFT':
        return Colors.grey;
      case 'SUBMITTED':
        return Colors.blue;
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Widget _buildFilterButton(String label, String value) {
    final isSelected = _statusFilter == value;
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: isSelected ? Colors.blue : Colors.grey.shade300,
        foregroundColor: isSelected ? Colors.white : Colors.black,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        minimumSize: const Size(0, 36),
      ),
      onPressed: () {
        setState(() {
          _statusFilter = value;
        });
      },
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}
