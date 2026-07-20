import 'package:flutter/material.dart';
import 'dart:convert';

class VanSaleScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const VanSaleScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<VanSaleScreen> createState() => _VanSaleScreenState();
}

class _VanSaleScreenState extends State<VanSaleScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchQuery = '';
  String _statusFilter = 'all';

  final _formKey = GlobalKey<FormState>();
  final _vehicleController = TextEditingController();
  final _routeController = TextEditingController();
  final _loadedItemsController = TextEditingController();

  final _saleFormKey = GlobalKey<FormState>();
  final _skuController = TextEditingController();
  final _qtyController = TextEditingController();
  final _priceController = TextEditingController();
  final _outletController = TextEditingController();

  final _reconcileFormKey = GlobalKey<FormState>();
  final _cashController = TextEditingController();
  final _digitalController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _seedInitialData();
  }

  void _seedInitialData() {
    _localCache.addAll([
      {
        'id': 'van-1001',
        'tenantId': widget.tenantId,
        'agentId': widget.agentId,
        'vehicleId': 'veh-9999',
        'routeId': 'beat-uuid-1',
        'date': '2026-06-20',
        'loadedItems': '[{"skuId":"SKU-FMCG-001","qty":50,"batchNumber":"BAT-01"}]',
        'soldItems': '[]',
        'returnedItems': '[]',
        'cashCollectedCents': 0,
        'cashCurrency': 'INR',
        'digitalPaymentsCents': 0,
        'digitalCurrency': 'INR',
        'status': 'loading',
        'version': 1,
        'syncStatus': 'synced',
      }
    ]);
  }

  void _showCreateSessionDialog() {
    _vehicleController.text = 'veh-9999';
    _routeController.text = 'beat-uuid-1';
    _loadedItemsController.text = '[{"skuId":"SKU-FMCG-001","qty":50,"batchNumber":"BAT-01"}]';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Start Van Sales Session'),
        content: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _vehicleController,
                  decoration: const InputDecoration(labelText: 'Vehicle ID *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'Vehicle ID required' : null,
                ),
                TextFormField(
                  controller: _routeController,
                  decoration: const InputDecoration(labelText: 'Route ID *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'Route ID required' : null,
                ),
                TextFormField(
                  controller: _loadedItemsController,
                  decoration: const InputDecoration(labelText: 'Loaded Items JSON *'),
                  maxLines: 3,
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Loaded items required';
                    try {
                      jsonDecode(val);
                      return null;
                    } catch (_) {
                      return 'Invalid JSON format';
                    }
                  },
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
                setState(() {
                  _localCache.add({
                    'id': 'van-${DateTime.now().millisecondsSinceEpoch}',
                    'tenantId': widget.tenantId,
                    'agentId': widget.agentId,
                    'vehicleId': _vehicleController.text,
                    'routeId': _routeController.text,
                    'date': DateTime.now().toIso8601String().split('T')[0],
                    'loadedItems': _loadedItemsController.text,
                    'soldItems': '[]',
                    'returnedItems': '[]',
                    'cashCollectedCents': 0,
                    'cashCurrency': 'INR',
                    'digitalPaymentsCents': 0,
                    'digitalCurrency': 'INR',
                    'status': 'loading',
                    'version': 1,
                    'syncStatus': _isOnline ? 'synced' : 'pending_insert',
                  });
                });
                Navigator.pop(ctx);
              }
            },
            child: const Text('Start'),
          )
        ],
      ),
    );
  }

  void _showRecordSaleDialog(String sessionId) {
    _skuController.text = 'SKU-FMCG-001';
    _qtyController.text = '5';
    _priceController.text = '1250';
    _outletController.text = 'out-1';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record Spot Sale'),
        content: Form(
          key: _saleFormKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _skuController,
                decoration: const InputDecoration(labelText: 'SKU ID *'),
                validator: (val) => (val == null || val.trim().isEmpty) ? 'SKU ID required' : null,
              ),
              TextFormField(
                controller: _qtyController,
                decoration: const InputDecoration(labelText: 'Quantity *'),
                keyboardType: TextInputType.number,
                validator: (val) => (val == null || int.tryParse(val) == null) ? 'Positive integer required' : null,
              ),
              TextFormField(
                controller: _priceController,
                decoration: const InputDecoration(labelText: 'Unit Price (Paise/Cents) *'),
                keyboardType: TextInputType.number,
                validator: (val) => (val == null || int.tryParse(val) == null) ? 'Positive integer required' : null,
              ),
              TextFormField(
                controller: _outletController,
                decoration: const InputDecoration(labelText: 'Outlet ID *'),
                validator: (val) => (val == null || val.trim().isEmpty) ? 'Outlet ID required' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (_saleFormKey.currentState!.validate()) {
                setState(() {
                  final session = _localCache.firstWhere((s) => s['id'] == sessionId);
                  final loaded = jsonDecode(session['loadedItems']) as List;
                  final sku = _skuController.text;
                  final qty = int.parse(_qtyController.text);

                  // Validate loaded quantity
                  final totalLoaded = loaded
                      .where((i) => i['skuId'] == sku)
                      .fold(0, (sum, i) => sum + (i['qty'] as int));

                  if (qty > totalLoaded) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Cannot sell $qty. Only $totalLoaded loaded.')),
                    );
                    return;
                  }

                  final soldList = jsonDecode(session['soldItems']) as List;
                  soldList.add({
                    'skuId': sku,
                    'qty': qty,
                    'unitPrice': int.parse(_priceController.text),
                    'outletId': _outletController.text,
                  });
                  session['soldItems'] = jsonEncode(soldList);
                  session['syncStatus'] = 'pending_update';
                  session['version'] = (session['version'] as int) + 1;
                });
                Navigator.pop(ctx);
              }
            },
            child: const Text('Record'),
          )
        ],
      ),
    );
  }

  void _showReconcileDialog(String sessionId) {
    _cashController.text = '125.00';
    _digitalController.text = '0.00';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cash & Payment Reconciliation'),
        content: Form(
          key: _reconcileFormKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _cashController,
                decoration: const InputDecoration(labelText: 'Cash Collected (Decimal) *'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (val) => (val == null || double.tryParse(val) == null) ? 'Number required' : null,
              ),
              TextFormField(
                controller: _digitalController,
                decoration: const InputDecoration(labelText: 'Digital Payments (Decimal) *'),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (val) => (val == null || double.tryParse(val) == null) ? 'Number required' : null,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (_reconcileFormKey.currentState!.validate()) {
                setState(() {
                  final session = _localCache.firstWhere((s) => s['id'] == sessionId);
                  final cash = (double.parse(_cashController.text) * 100).round();
                  final digital = (double.parse(_digitalController.text) * 100).round();

                  session['cashCollectedCents'] = cash;
                  session['digitalPaymentsCents'] = digital;
                  session['status'] = 'reconciliation';
                  session['syncStatus'] = 'pending_update';
                  session['version'] = (session['version'] as int) + 1;
                });
                Navigator.pop(ctx);
              }
            },
            child: const Text('Submit'),
          )
        ],
      ),
    );
  }

  void _transitionStatus(String sessionId, String nextStatus) {
    setState(() {
      final session = _localCache.firstWhere((s) => s['id'] == sessionId);
      session['status'] = nextStatus;
      session['syncStatus'] = 'pending_update';
      session['version'] = (session['version'] as int) + 1;
    });
  }

  void _deleteSession(String sessionId) {
    setState(() {
      _localCache.removeWhere((s) => s['id'] == sessionId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final filteredSessions = _localCache.where((s) {
      final matchesSearch = s['vehicleId'].toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s['routeId'].toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesStatus = _statusFilter == 'all' || s['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Van Sales Sessions'),
        actions: [
          Row(
            children: [
              Icon(
                _isOnline ? Icons.cloud_done : Icons.cloud_off,
                color: _isOnline ? Colors.green : Colors.red,
              ),
              const SizedBox(width: 4),
              Text(_isOnline ? 'Online' : 'Offline'),
              Switch(
                value: _isOnline,
                onChanged: (val) {
                  setState(() => _isOnline = val);
                },
              ),
            ],
          )
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search sessions by vehicle or route',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) => setState(() => _searchQuery = val),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: DropdownButtonFormField<String>(
              initialValue: _statusFilter,
              decoration: const InputDecoration(labelText: 'Filter Status'),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                DropdownMenuItem(value: 'loading', child: Text('Loading')),
                DropdownMenuItem(value: 'in_transit', child: Text('In Transit')),
                DropdownMenuItem(value: 'selling', child: Text('Selling')),
                DropdownMenuItem(value: 'reconciliation', child: Text('Reconciliation')),
                DropdownMenuItem(value: 'closed', child: Text('Closed')),
              ],
              onChanged: (val) => setState(() => _statusFilter = val!),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: filteredSessions.length,
              itemBuilder: (ctx, idx) {
                final session = filteredSessions[idx];
                final loaded = jsonDecode(session['loadedItems']) as List;
                final sold = jsonDecode(session['soldItems']) as List;

                return Card(
                  margin: const EdgeInsets.all(8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Session ID: ${session['id']}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Chip(
                              label: Text(session['status'].toString().toUpperCase()),
                              backgroundColor: session['status'] == 'closed' ? Colors.grey : Colors.blue,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text('Vehicle: ${session['vehicleId']} • Route: ${session['routeId']} • Date: ${session['date']}'),
                        Text('Loaded: ${loaded.length} SKUs • Sold: ${sold.length} items • Version: ${session['version']}'),
                        Text('Sync Status: ${session['syncStatus'].toString().toUpperCase()}'),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            if (session['status'] == 'loading')
                              ElevatedButton(
                                onPressed: () => _transitionStatus(session['id'], 'in_transit'),
                                child: const Text('Start Transit'),
                              ),
                            if (session['status'] == 'in_transit')
                              ElevatedButton(
                                onPressed: () => _transitionStatus(session['id'], 'selling'),
                                child: const Text('Start Selling'),
                              ),
                            if (session['status'] == 'selling') ...[
                              ElevatedButton(
                                onPressed: () => _showRecordSaleDialog(session['id']),
                                child: const Text('Record Spot Sale'),
                              ),
                              ElevatedButton(
                                onPressed: () => _showReconcileDialog(session['id']),
                                child: const Text('Reconcile Payments'),
                              ),
                            ],
                            if (session['status'] == 'reconciliation')
                              ElevatedButton(
                                onPressed: () => _transitionStatus(session['id'], 'closed'),
                                child: const Text('Close Session'),
                              ),
                            IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red),
                              onPressed: () => _deleteSession(session['id']),
                            )
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          )
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateSessionDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}
