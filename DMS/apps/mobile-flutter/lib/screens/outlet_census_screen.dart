import 'package:flutter/material.dart';

class OutletCensusScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const OutletCensusScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<OutletCensusScreen> createState() => _OutletCensusScreenState();
}

class _OutletCensusScreenState extends State<OutletCensusScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchQuery = '';
  String _statusFilter = 'all';
  String _sortBy = 'name';

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _ownerNameController = TextEditingController();
  final _addressController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();

  String _outletType = 'kirana';
  String _tradeCategory = 'Groceries';
  String? _editingId;

  @override
  void initState() {
    super.initState();
    _seedInitialData();
  }

  void _seedInitialData() {
    _localCache.addAll([
      {
        'id': 'cen-1001',
        'tenantId': widget.tenantId,
        'outletId': 'out-1',
        'outletName': 'HyperMarket Zone',
        'outletType': 'kirana',
        'ownerName': 'Sagar Kumar',
        'ownerPhone': '9876543210',
        'address': 'Shop 5, Connaught Place, New Delhi',
        'latitude': 28.6139,
        'longitude': 77.2090,
        'tradeCategory': 'Groceries',
        'status': 'submitted',
        'kycStatus': 'approved',
        'version': 1,
        'syncStatus': 'synced',
      },
      {
        'id': 'cen-1002',
        'tenantId': widget.tenantId,
        'outletId': 'out-2',
        'outletName': 'Koramangala Grocery Store',
        'outletType': 'supermarket',
        'ownerName': 'Rahul Verma',
        'ownerPhone': '9812345678',
        'address': 'Lane 2, Koramangala, Bangalore',
        'latitude': 12.93,
        'longitude': 77.62,
        'tradeCategory': 'Beverages',
        'status': 'draft',
        'kycStatus': 'pending',
        'version': 1,
        'syncStatus': 'synced',
      }
    ]);
  }

  void _showFormDialog({String? id}) {
    if (id != null) {
      final record = _localCache.firstWhere((r) => r['id'] == id);
      _editingId = id;
      _nameController.text = record['outletName'];
      _phoneController.text = record['ownerPhone'];
      _ownerNameController.text = record['ownerName'] ?? '';
      _addressController.text = record['address'] ?? '';
      _latController.text = record['latitude'].toString();
      _lngController.text = record['longitude'].toString();
      _outletType = record['outletType'];
      _tradeCategory = record['tradeCategory'];
    } else {
      _editingId = null;
      _nameController.clear();
      _phoneController.clear();
      _ownerNameController.clear();
      _addressController.clear();
      _latController.text = '12.9716';
      _lngController.text = '77.5946';
      _outletType = 'kirana';
      _tradeCategory = 'Groceries';
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_editingId == null ? 'New Outlet Census' : 'Edit Outlet Census'),
        content: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Outlet Name *'),
                  validator: (val) => (val == null || val.trim().isEmpty) ? 'Outlet Name required' : null,
                ),
                TextFormField(
                  controller: _phoneController,
                  decoration: const InputDecoration(labelText: 'Owner Phone *'),
                  keyboardType: TextInputType.phone,
                  validator: (val) => (val == null || val.trim().length < 10) ? 'Phone must be >= 10 digits' : null,
                ),
                TextFormField(
                  controller: _ownerNameController,
                  decoration: const InputDecoration(labelText: 'Owner Name'),
                ),
                TextFormField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'Address'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _outletType,
                  decoration: const InputDecoration(labelText: 'Outlet Type'),
                  items: const [
                    DropdownMenuItem(value: 'kirana', child: Text('Kirana / Mom-and-Pop')),
                    DropdownMenuItem(value: 'supermarket', child: Text('Supermarket')),
                    DropdownMenuItem(value: 'wholesale', child: Text('Wholesale')),
                    DropdownMenuItem(value: 'convenience', child: Text('Convenience Store')),
                  ],
                  onChanged: (val) => setState(() => _outletType = val!),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _tradeCategory,
                  decoration: const InputDecoration(labelText: 'Trade Category'),
                  items: const [
                    DropdownMenuItem(value: 'Groceries', child: Text('Groceries')),
                    DropdownMenuItem(value: 'Beverages', child: Text('Beverages')),
                    DropdownMenuItem(value: 'Personal Care', child: Text('Personal Care')),
                    DropdownMenuItem(value: 'Snacks & Confectionery', child: Text('Snacks & Confectionery')),
                  ],
                  onChanged: (val) => setState(() => _tradeCategory = val!),
                ),
                TextFormField(
                  controller: _latController,
                  decoration: const InputDecoration(labelText: 'Latitude (-90 to 90)'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  validator: (val) {
                    final d = double.tryParse(val ?? '');
                    if (d == null || d < -90 || d > 90) return 'Invalid latitude';
                    return null;
                  },
                ),
                TextFormField(
                  controller: _lngController,
                  decoration: const InputDecoration(labelText: 'Longitude (-180 to 180)'),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  validator: (val) {
                    final d = double.tryParse(val ?? '');
                    if (d == null || d < -180 || d > 180) return 'Invalid longitude';
                    return null;
                  },
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => _saveForm(ctx),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _saveForm(BuildContext dialogCtx) {
    if (!_formKey.currentState!.validate()) return;

    final lat = double.parse(_latController.text);
    final lng = double.parse(_lngController.text);

    setState(() {
      if (_editingId != null) {
        final idx = _localCache.indexWhere((r) => r['id'] == _editingId);
        if (idx != -1) {
          _localCache[idx]['outletName'] = _nameController.text;
          _localCache[idx]['ownerPhone'] = _phoneController.text;
          _localCache[idx]['ownerName'] = _ownerNameController.text;
          _localCache[idx]['address'] = _addressController.text;
          _localCache[idx]['latitude'] = lat;
          _localCache[idx]['longitude'] = lng;
          _localCache[idx]['outletType'] = _outletType;
          _localCache[idx]['tradeCategory'] = _tradeCategory;
          _localCache[idx]['syncStatus'] = 'pending_update';
          _localCache[idx]['version'] += 1;
        }
      } else {
        final newRecord = {
          'id': 'cen-${DateTime.now().millisecondsSinceEpoch}',
          'tenantId': widget.tenantId,
          'outletId': 'out-3',
          'outletName': _nameController.text,
          'outletType': _outletType,
          'ownerName': _ownerNameController.text,
          'ownerPhone': _phoneController.text,
          'address': _addressController.text,
          'latitude': lat,
          'longitude': lng,
          'tradeCategory': _tradeCategory,
          'status': 'draft',
          'kycStatus': 'pending',
          'version': 1,
          'syncStatus': 'pending_insert',
        };
        _localCache.add(newRecord);
      }
    });

    Navigator.pop(dialogCtx);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Census saved to local cache')),
    );
  }

  Future<void> _syncData() async {
    if (!_isOnline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Offline mode active. Cannot sync.')),
      );
      return;
    }

    setState(() {
      // Process pending offline items and resolve conflicts
      for (var record in _localCache) {
        if (record['syncStatus'] == 'pending_insert' || record['syncStatus'] == 'pending_update') {
          record['syncStatus'] = 'synced';
        }
      }
      // Remove tombstones (deleted items)
      _localCache.removeWhere((r) => r['syncStatus'] == 'tombstone');
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sync successful! Server and cache aligned.')),
    );
  }

  void _deleteCensus(String id) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: const Text('Are you sure you want to delete this census record?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              setState(() {
                final idx = _localCache.indexWhere((r) => r['id'] == id);
                if (idx != -1) {
                  if (_localCache[idx]['syncStatus'] == 'pending_insert') {
                    // Item never synced to server, delete immediately
                    _localCache.removeAt(idx);
                  } else {
                    // Mark as tombstone for deletion sync
                    _localCache[idx]['syncStatus'] = 'tombstone';
                  }
                }
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Record deleted locally')),
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredList = _localCache.where((c) {
      if (c['syncStatus'] == 'tombstone') return false;

      final matchesSearch = c['outletName'].toLowerCase().contains(_searchQuery.toLowerCase()) ||
          c['ownerPhone'].toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesStatus = _statusFilter == 'all' || c['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    filteredList.sort((a, b) {
      if (_sortBy == 'name') {
        return a['outletName'].toString().compareTo(b['outletName'].toString());
      } else {
        return a['tradeCategory'].toString().compareTo(b['tradeCategory'].toString());
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Outlet Census Registry'),
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
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search by Outlet Name or Phone',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) => setState(() => _searchQuery = val),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButton<String>(
                    value: _statusFilter,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All Statuses')),
                      DropdownMenuItem(value: 'draft', child: Text('Draft')),
                      DropdownMenuItem(value: 'submitted', child: Text('Submitted')),
                      DropdownMenuItem(value: 'verified', child: Text('Verified')),
                      DropdownMenuItem(value: 'approved', child: Text('Approved')),
                      DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
                    ],
                    onChanged: (val) => setState(() => _statusFilter = val!),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButton<String>(
                    value: _sortBy,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: 'name', child: Text('Sort by Name')),
                      DropdownMenuItem(value: 'category', child: Text('Sort by Category')),
                    ],
                    onChanged: (val) => setState(() => _sortBy = val!),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: filteredList.isEmpty
                ? const Center(child: Text('No census records found.'))
                : ListView.builder(
                    itemCount: filteredList.length,
                    itemBuilder: (ctx, idx) {
                      final item = filteredList[idx];
                      Color statusColor = Colors.orange;
                      if (item['status'] == 'approved') statusColor = Colors.green;
                      if (item['status'] == 'rejected') statusColor = Colors.red;
                      if (item['status'] == 'verified') statusColor = Colors.blue;

                      return Card(
                        margin: const EdgeInsets.all(8.0),
                        child: ListTile(
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item['outletName'],
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
                              Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                 decoration: BoxDecoration(
                                   color: statusColor.withValues(alpha: 0.2),
                                   borderRadius: BorderRadius.circular(4),
                                 ),
                                child: Text(
                                  item['status'].toString().toUpperCase(),
                                  style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text('Owner: ${item['ownerName']} (${item['ownerPhone']})'),
                              Text('GPS: (${item['latitude']}, ${item['longitude']})'),
                              Text('Category: ${item['tradeCategory']} • Version: ${item['version']}'),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(
                                    item['syncStatus'] == 'synced' ? Icons.check_circle : Icons.sync_problem,
                                    size: 14,
                                    color: item['syncStatus'] == 'synced' ? Colors.green : Colors.orange,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    item['syncStatus'] == 'synced' ? 'Synced' : 'Offline Pending',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: item['syncStatus'] == 'synced' ? Colors.green : Colors.orange,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit, color: Colors.blue),
                                onPressed: () => _showFormDialog(id: item['id']),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.red),
                                onPressed: () => _deleteCensus(item['id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.add),
                    label: const Text('Add Census'),
                    onPressed: () => _showFormDialog(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.sync),
                    label: const Text('Sync Cache'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo),
                    onPressed: _syncData,
                  ),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}
