import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:typed_data';
import '../database/delivery_confirmation_db.dart';

class DeliveryConfirmationScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const DeliveryConfirmationScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<DeliveryConfirmationScreen> createState() => _DeliveryConfirmationScreenState();
}

class _DeliveryConfirmationScreenState extends State<DeliveryConfirmationScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchQuery = '';
  String _statusFilter = 'all';

  // Encryption key (mock 32-byte key for AES-GCM cipher)
  final Uint8List _encryptionKey = Uint8List.fromList(
    List.generate(32, (index) => index + 10),
  );
  late final EncryptedDeliveryConfirmationCache _cipherCache;

  final _formKey = GlobalKey<FormState>();
  final _orderIdController = TextEditingController();
  final _receivedByController = TextEditingController();
  final _signatureUrlController = TextEditingController();
  final _latController = TextEditingController();
  final _lonController = TextEditingController();
  final _rejectionReasonController = TextEditingController();
  String _selectedStatus = 'FULL';

  final _updateFormKey = GlobalKey<FormState>();
  final _updateReceivedByController = TextEditingController();
  final _updateSignatureUrlController = TextEditingController();
  final _updateRejectionReasonController = TextEditingController();
  String _updateSelectedStatus = 'FULL';

  @override
  void initState() {
    super.initState();
    _cipherCache = EncryptedDeliveryConfirmationCache(_encryptionKey);
    _seedInitialData();
  }

  void _seedInitialData() {
    // Seed one encrypted item in cache
    final encryptedData = _cipherCache.encryptFields(receivedBy: 'Jane Smith');
    _localCache.add({
      'id': 'conf-001',
      'tenantId': widget.tenantId,
      'orderId': 'order-uuid-999',
      'deliveredAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
      'receivedBy': encryptedData['receivedBy'],
      'signaturePhotoUrl': 'http://images.com/signature1.png',
      'latitude': 12.9716,
      'longitude': 77.5946,
      'status': 'FULL',
      'rejectionReason': null,
      'version': 1,
      'syncStatus': 'synced',
    });
  }

  // Helper to decrypt row value for display
  String _getDecryptedReceivedBy(String encryptedValue) {
    try {
      final decrypted = _cipherCache.decryptFields(encryptedReceivedBy: encryptedValue);
      return decrypted['receivedBy'] ?? 'Decryption Failed';
    } catch (_) {
      return 'Decryption Failed';
    }
  }

  void _showCreateDialog() {
    _orderIdController.text = 'order-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    _receivedByController.text = 'John Doe';
    _signatureUrlController.text = 'http://images.com/sig.png';
    _latController.text = '12.9716';
    _lonController.text = '77.5946';
    _rejectionReasonController.clear();
    _selectedStatus = 'FULL';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New Delivery Confirmation'),
          content: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _orderIdController,
                    decoration: const InputDecoration(labelText: 'Order ID *'),
                    validator: (val) => (val == null || val.trim().isEmpty) ? 'Order ID required' : null,
                  ),
                  TextFormField(
                    controller: _receivedByController,
                    decoration: const InputDecoration(labelText: 'Received By Name *'),
                    validator: (val) => (val == null || val.trim().isEmpty) ? 'Received By is required' : null,
                  ),
                  TextFormField(
                    controller: _signatureUrlController,
                    decoration: const InputDecoration(labelText: 'Signature Photo URL'),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _latController,
                          decoration: const InputDecoration(labelText: 'Latitude *'),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          validator: (val) {
                            final numVal = double.tryParse(val ?? '');
                            if (numVal == null || numVal < -90.0 || numVal > 90.0) {
                              return 'Invalid lat (-90 to 90)';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _lonController,
                          decoration: const InputDecoration(labelText: 'Longitude *'),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          validator: (val) {
                            final numVal = double.tryParse(val ?? '');
                            if (numVal == null || numVal < -180.0 || numVal > 180.0) {
                              return 'Invalid lon (-180 to 180)';
                            }
                            return null;
                          },
                        ),
                      ),
                    ],
                  ),
                  DropdownButtonFormField<String>(
                    value: _selectedStatus,
                    decoration: const InputDecoration(labelText: 'Delivery Status *'),
                    items: const [
                      DropdownMenuItem(value: 'FULL', child: Text('FULL')),
                      DropdownMenuItem(value: 'PARTIAL', child: Text('PARTIAL')),
                      DropdownMenuItem(value: 'REJECTED', child: Text('REJECTED')),
                    ],
                    onChanged: (val) {
                      setDialogState(() {
                        _selectedStatus = val ?? 'FULL';
                      });
                    },
                  ),
                  if (_selectedStatus == 'REJECTED')
                    TextFormField(
                      controller: _rejectionReasonController,
                      decoration: const InputDecoration(labelText: 'Rejection Reason *'),
                      validator: (val) => (val == null || val.trim().isEmpty) ? 'Reason required' : null,
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
                  final encrypted = _cipherCache.encryptFields(receivedBy: _receivedByController.text);
                  
                  setState(() {
                    _localCache.add({
                      'id': 'conf-${DateTime.now().millisecondsSinceEpoch}',
                      'tenantId': widget.tenantId,
                      'orderId': _orderIdController.text,
                      'deliveredAt': DateTime.now().toIso8601String(),
                      'receivedBy': encrypted['receivedBy'],
                      'signaturePhotoUrl': _signatureUrlController.text.isEmpty ? null : _signatureUrlController.text,
                      'latitude': double.parse(_latController.text),
                      'longitude': double.parse(_lonController.text),
                      'status': _selectedStatus,
                      'rejectionReason': _selectedStatus == 'REJECTED' ? _rejectionReasonController.text : null,
                      'version': 1,
                      'syncStatus': _isOnline ? 'synced' : 'pending_insert',
                    });
                  });
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(_isOnline ? 'Confirmation created & synced' : 'Saved offline in queue')),
                  );
                }
              },
              child: const Text('Save'),
            )
          ],
        ),
      ),
    );
  }

  void _showUpdateDialog(Map<String, dynamic> item) {
    final currentStatus = item['status'] as String;
    final decryptedName = _getDecryptedReceivedBy(item['receivedBy'] as String);

    _updateReceivedByController.text = decryptedName;
    _updateSignatureUrlController.text = item['signaturePhotoUrl'] ?? '';
    _updateRejectionReasonController.text = item['rejectionReason'] ?? '';
    _updateSelectedStatus = currentStatus;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Update Status'),
          content: SingleChildScrollView(
            child: Form(
              key: _updateFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _updateReceivedByController,
                    decoration: const InputDecoration(labelText: 'Received By *'),
                    validator: (val) => (val == null || val.trim().isEmpty) ? 'Name required' : null,
                  ),
                  TextFormField(
                    controller: _updateSignatureUrlController,
                    decoration: const InputDecoration(labelText: 'Signature URL'),
                  ),
                  DropdownButtonFormField<String>(
                    value: _updateSelectedStatus,
                    decoration: const InputDecoration(labelText: 'Status *'),
                    items: const [
                      DropdownMenuItem(value: 'FULL', child: Text('FULL')),
                      DropdownMenuItem(value: 'PARTIAL', child: Text('PARTIAL')),
                      DropdownMenuItem(value: 'REJECTED', child: Text('REJECTED')),
                    ],
                    onChanged: (val) {
                      setDialogState(() {
                        _updateSelectedStatus = val ?? 'FULL';
                      });
                    },
                  ),
                  if (_updateSelectedStatus == 'REJECTED')
                    TextFormField(
                      controller: _updateRejectionReasonController,
                      decoration: const InputDecoration(labelText: 'Rejection Reason *'),
                      validator: (val) => (val == null || val.trim().isEmpty) ? 'Reason required' : null,
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
                  // Invariant transition check
                  if (currentStatus == 'FULL' && _updateSelectedStatus != 'FULL') {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Cannot transition from FULL status')),
                    );
                    return;
                  }

                  final encrypted = _cipherCache.encryptFields(receivedBy: _updateReceivedByController.text);

                  setState(() {
                    item['receivedBy'] = encrypted['receivedBy'];
                    item['signaturePhotoUrl'] = _updateSignatureUrlController.text.isEmpty ? null : _updateSignatureUrlController.text;
                    item['status'] = _updateSelectedStatus;
                    item['rejectionReason'] = _updateSelectedStatus == 'REJECTED' ? _updateRejectionReasonController.text : null;
                    
                    if (item['syncStatus'] == 'synced') {
                      item['syncStatus'] = 'pending_update';
                    }
                  });
                  Navigator.pop(ctx);
                }
              },
              child: const Text('Update'),
            )
          ],
        ),
      ),
    );
  }

  void _triggerSync() {
    setState(() {
      for (final item in _localCache) {
        if (item['syncStatus'] == 'pending_insert' || item['syncStatus'] == 'pending_update') {
          // Simulate conflict resolution: if server side has updated version (simulate 50% chance of no conflict)
          item['syncStatus'] = 'synced';
          item['version'] = (item['version'] as int) + 1;
        }
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Synchronization complete: local cache successfully synced.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredConfirmations = _localCache.where((c) {
      final decryptedName = _getDecryptedReceivedBy(c['receivedBy'] as String);
      final matchesSearch = c['orderId'].toString().toLowerCase().contains(_searchQuery.toLowerCase()) ||
          decryptedName.toLowerCase().contains(_searchQuery.toLowerCase());
      
      final matchesStatus = _statusFilter == 'all' || c['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Delivery Confirmations (Offline-First)'),
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
            onPressed: _triggerSync,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search by Order ID or Receiver name',
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
              _buildFilterButton('FULL', 'FULL'),
              _buildFilterButton('PARTIAL', 'PARTIAL'),
              _buildFilterButton('REJECTED', 'REJECTED'),
            ],
          ),
          Expanded(
            child: ListView.builder(
              itemCount: filteredConfirmations.length,
              itemBuilder: (ctx, index) {
                final item = filteredConfirmations[index];
                final decryptedName = _getDecryptedReceivedBy(item['receivedBy'] as String);
                final isPending = item['syncStatus'] != 'synced';

                return Card(
                  color: isPending ? Colors.orange.shade50 : null,
                  margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  child: ListTile(
                    title: Text('Order ID: ${item['orderId']}'),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Received By: $decryptedName (Decrypted)'),
                        Text('Coordinates: (${item['latitude']}, ${item['longitude']})'),
                        if (item['rejectionReason'] != null)
                          Text('Rejection Reason: ${item['rejectionReason']}', style: const TextStyle(color: Colors.red)),
                        Text('Sync Status: ${item['syncStatus']} | Version: ${item['version']}'),
                      ],
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: item['status'] == 'FULL'
                                ? Colors.green
                                : (item['status'] == 'PARTIAL' ? Colors.orange : Colors.red),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item['status'],
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
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

  Widget _buildFilterButton(String label, String value) {
    final isSelected = _statusFilter == value;
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: isSelected ? Colors.blue : Colors.grey.shade300,
        foregroundColor: isSelected ? Colors.white : Colors.black,
      ),
      onPressed: () {
        setState(() {
          _statusFilter = value;
        });
      },
      child: Text(label),
    );
  }
}
