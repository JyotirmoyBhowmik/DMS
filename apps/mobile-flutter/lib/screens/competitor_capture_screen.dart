import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:typed_data';
import '../database/competitor_capture_db.dart';

class CompetitorCaptureScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const CompetitorCaptureScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<CompetitorCaptureScreen> createState() => _CompetitorCaptureScreenState();
}

class _CompetitorCaptureScreenState extends State<CompetitorCaptureScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchQuery = '';
  String _statusFilter = 'all';

  // Encryption key (mock 32-byte key for AES-GCM cipher)
  final Uint8List _encryptionKey = Uint8List.fromList(
    List.generate(32, (index) => index + 30),
  );
  late final EncryptedCompetitorCaptureCache _cipherCache;

  final _formKey = GlobalKey<FormState>();
  final _outletIdController = TextEditingController();
  final _captureDateController = TextEditingController();
  final _brandController = TextEditingController();
  final _skuIdController = TextEditingController();
  final _observedPriceController = TextEditingController();
  final _promoDetailsController = TextEditingController();
  final _photoUrlController = TextEditingController();
  final _notesController = TextEditingController();

  final _updateFormKey = GlobalKey<FormState>();
  final _updatePriceController = TextEditingController();
  final _updatePromoController = TextEditingController();
  final _updatePhotoController = TextEditingController();
  final _updateNotesController = TextEditingController();
  String _updateSelectedStatus = 'DRAFT';

  @override
  void initState() {
    super.initState();
    _cipherCache = EncryptedCompetitorCaptureCache(_encryptionKey);
    _seedInitialData();
  }

  void _seedInitialData() {
    final encrypted = _cipherCache.encryptFields(
      promotionDetails: 'Discount of 10% on bulk purchase',
      notes: 'Pepsi has prime shelf space placement',
    );
    _localCache.add({
      'id': 'cap-001',
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'outletId': 'outlet-uuid-123',
      'captureDate': '2026-07-19',
      'brand': 'Pepsi',
      'skuId': 'pepsi-500ml',
      'observedPriceCents': 120,
      'promotionDetails': encrypted['promotionDetails'],
      'photoUrl': 'http://img.com/pep.png',
      'notes': encrypted['notes'],
      'status': 'DRAFT',
      'version': 1,
      'syncStatus': 'synced',
      'createdAt': DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
    });
  }

  Map<String, String?> _getDecryptedFields(dynamic encryptedPromo, dynamic encryptedNotes) {
    try {
      final decrypted = _cipherCache.decryptFields(
        encryptedPromo: encryptedPromo as String?,
        encryptedNotes: encryptedNotes as String?,
      );
      return decrypted;
    } catch (_) {
      return {'promotionDetails': 'Decryption Failed', 'notes': 'Decryption Failed'};
    }
  }

  bool _canSubmit(String currentStatus) {
    return currentStatus == 'DRAFT';
  }

  void _showCreateDialog() {
    _outletIdController.text = 'outlet-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    _captureDateController.text = DateTime.now().toIso8601String().substring(0, 10);
    _brandController.text = 'Coke';
    _skuIdController.text = 'coke-330ml';
    _observedPriceController.text = '90';
    _promoDetailsController.clear();
    _photoUrlController.clear();
    _notesController.clear();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Competitor Capture'),
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
                  controller: _captureDateController,
                  decoration: const InputDecoration(labelText: 'Capture Date (YYYY-MM-DD) *'),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Capture date required';
                    final dateRegex = RegExp(r'^\d{4}-\d{2}-\d{2}$');
                    if (!dateRegex.hasMatch(val)) return 'Format: YYYY-MM-DD';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _brandController,
                  decoration: const InputDecoration(labelText: 'Brand *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'Brand required' : null,
                ),
                TextFormField(
                  controller: _skuIdController,
                  decoration: const InputDecoration(labelText: 'SKU ID *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'SKU ID required' : null,
                ),
                TextFormField(
                  controller: _observedPriceController,
                  decoration: const InputDecoration(labelText: 'Observed Price (cents) *'),
                  keyboardType: TextInputType.number,
                  validator: (val) {
                    final num = int.tryParse(val ?? '');
                    if (num == null || num < 0) return 'Must be non-negative integer';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _promoDetailsController,
                  decoration: const InputDecoration(labelText: 'Promo Details (optional, encrypted)'),
                ),
                TextFormField(
                  controller: _photoUrlController,
                  decoration: const InputDecoration(labelText: 'Photo URL (optional)'),
                ),
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(labelText: 'Notes (optional, encrypted)'),
                  maxLines: 2,
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
                final encrypted = _cipherCache.encryptFields(
                  promotionDetails: _promoDetailsController.text,
                  notes: _notesController.text,
                );

                setState(() {
                  _localCache.add({
                    'id': 'cap-${DateTime.now().millisecondsSinceEpoch}',
                    'tenantId': widget.tenantId,
                    'agentId': widget.agentId,
                    'outletId': _outletIdController.text,
                    'captureDate': _captureDateController.text,
                    'brand': _brandController.text,
                    'skuId': _skuIdController.text,
                    'observedPriceCents': int.parse(_observedPriceController.text),
                    'promotionDetails': encrypted['promotionDetails'],
                    'photoUrl': _photoUrlController.text.isEmpty ? null : _photoUrlController.text,
                    'notes': encrypted['notes'],
                    'status': 'DRAFT',
                    'version': 1,
                    'syncStatus': _isOnline ? 'synced' : 'pending_insert',
                    'createdAt': DateTime.now().toIso8601String(),
                  });
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(_isOnline ? 'Capture created & synced' : 'Saved offline in queue')),
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

  void _showUpdateDialog(Map<String, dynamic> item) {
    final currentStatus = item['status'] as String;
    final decrypted = _getDecryptedFields(item['promotionDetails'], item['notes']);

    _updatePriceController.text = item['observedPriceCents'].toString();
    _updatePromoController.text = decrypted['promotionDetails'] ?? '';
    _updatePhotoController.text = item['photoUrl'] ?? '';
    _updateNotesController.text = decrypted['notes'] ?? '';
    _updateSelectedStatus = currentStatus;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Update Competitor Capture'),
          content: SingleChildScrollView(
            child: Form(
              key: _updateFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _updatePriceController,
                    decoration: const InputDecoration(labelText: 'Price (cents) *'),
                    keyboardType: TextInputType.number,
                    enabled: currentStatus == 'DRAFT',
                    validator: (val) {
                      final num = int.tryParse(val ?? '');
                      if (num == null || num < 0) return 'Must be non-negative integer';
                      return null;
                    },
                  ),
                  TextFormField(
                    controller: _updatePromoController,
                    decoration: const InputDecoration(labelText: 'Promo Details'),
                    enabled: currentStatus == 'DRAFT',
                  ),
                  TextFormField(
                    controller: _updatePhotoController,
                    decoration: const InputDecoration(labelText: 'Photo URL'),
                    enabled: currentStatus == 'DRAFT',
                  ),
                  TextFormField(
                    controller: _updateNotesController,
                    decoration: const InputDecoration(labelText: 'Notes'),
                    enabled: currentStatus == 'DRAFT',
                    maxLines: 2,
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
                  if (_updateSelectedStatus == 'SUBMITTED' && currentStatus != 'DRAFT') {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Cannot submit — capture is not in DRAFT status')),
                    );
                    return;
                  }

                  final encrypted = _cipherCache.encryptFields(
                    promotionDetails: _updatePromoController.text,
                    notes: _updateNotesController.text,
                  );

                  setState(() {
                    if (currentStatus == 'DRAFT') {
                      item['observedPriceCents'] = int.parse(_updatePriceController.text);
                      item['promotionDetails'] = encrypted['promotionDetails'];
                      item['photoUrl'] = _updatePhotoController.text.isEmpty ? null : _updatePhotoController.text;
                      item['notes'] = encrypted['notes'];
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
                            ? 'Capture submitted for approval'
                            : 'Capture updated locally',
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
    setState(() {
      for (final item in _localCache) {
        if (item['syncStatus'] == 'pending_insert' || item['syncStatus'] == 'pending_update') {
          item['syncStatus'] = 'synced';
          item['version'] = (item['version'] as int) + 1;
          synced++;
        }
      }
      _localCache.removeWhere((item) => item['syncStatus'] == 'tombstone');
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Sync complete: $synced item(s) synchronized.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _localCache.where((c) {
      final brand = c['brand'].toString().toLowerCase();
      final sku = c['skuId'].toString().toLowerCase();
      final matchesSearch = brand.contains(_searchQuery.toLowerCase()) ||
          sku.contains(_searchQuery.toLowerCase());
      final matchesStatus = _statusFilter == 'all' || c['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Competitor Capture (Offline-First)'),
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
            tooltip: 'Sync Now',
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search by Brand or SKU ID',
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
            child: filtered.isEmpty
                ? const Center(child: Text('No competitor captures found. Tap + to add.'))
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (ctx, index) {
                      final item = filtered[index];
                      final decrypted = _getDecryptedFields(item['promotionDetails'], item['notes']);
                      final isPending = item['syncStatus'] != 'synced';

                      return Card(
                        color: isPending ? Colors.orange.shade50 : null,
                        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: ListTile(
                          title: Text('${item['brand']} — ${item['skuId']}'),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Outlet: ${item['outletId']} | Date: ${item['captureDate']}'),
                              Text('Price: \$${(item['observedPriceCents'] / 100).toStringAsFixed(2)}'),
                              if (decrypted['promotionDetails'] != null && decrypted['promotionDetails']!.isNotEmpty)
                                Text('Promo: ${decrypted['promotionDetails']} (Decrypted)', style: const TextStyle(fontStyle: FontStyle.italic)),
                              if (decrypted['notes'] != null && decrypted['notes']!.isNotEmpty)
                                Text('Notes: ${decrypted['notes']} (Decrypted)', style: const TextStyle(fontStyle: FontStyle.italic)),
                              Text(
                                'Sync: ${item['syncStatus']} | v${item['version']}',
                                style: TextStyle(color: isPending ? Colors.orange.shade800 : Colors.grey, fontSize: 11),
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
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
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
      case 'DRAFT': return Colors.grey;
      case 'SUBMITTED': return Colors.blue;
      case 'APPROVED': return Colors.green;
      case 'REJECTED': return Colors.red;
      default: return Colors.grey;
    }
  }

  Widget _buildFilterButton(String label, String value) {
    final isSelected = _statusFilter == value;
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: isSelected ? Colors.blue : Colors.grey.shade300,
        foregroundColor: isSelected ? Colors.white : Colors.black,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        minimumSize: const Size(0, 32),
      ),
      onPressed: () {
        setState(() {
          _statusFilter = value;
        });
      },
      child: Text(label, style: const TextStyle(fontSize: 11)),
    );
  }
}
