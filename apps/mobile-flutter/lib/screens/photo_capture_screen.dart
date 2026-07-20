import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:typed_data';
import '../database/photo_capture_db.dart';

class PhotoCaptureScreen extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const PhotoCaptureScreen({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<PhotoCaptureScreen> createState() => _PhotoCaptureScreenState();
}

class _PhotoCaptureScreenState extends State<PhotoCaptureScreen> {
  final List<Map<String, dynamic>> _localCache = [];
  bool _isOnline = true;
  String _searchTag = '';
  String _statusFilter = 'all';

  // 32-byte AES key
  final Uint8List _encryptionKey = Uint8List.fromList(
    List.generate(32, (index) => index + 45),
  );
  late final EncryptedPhotoCaptureCache _cipherCache;

  final _formKey = GlobalKey<FormState>();
  final _outletIdController = TextEditingController();
  final _captureDateController = TextEditingController();
  final _photoUrlController = TextEditingController();
  final _tagsController = TextEditingController(); // Comma-separated
  final _notesController = TextEditingController();

  final _updateFormKey = GlobalKey<FormState>();
  final _updatePhotoController = TextEditingController();
  final _updateTagsController = TextEditingController();
  final _updateNotesController = TextEditingController();
  String _updateSelectedStatus = 'DRAFT';

  @override
  void initState() {
    super.initState();
    _cipherCache = EncryptedPhotoCaptureCache(_encryptionKey);
    _seedInitialData();
  }

  void _seedInitialData() {
    final encryptedNotes = _cipherCache.encryptNotes('Merchandiser did an excellent display job');
    _localCache.add({
      'id': 'photo-001',
      'tenantId': widget.tenantId,
      'agentId': widget.agentId,
      'outletId': 'outlet-uuid-123',
      'captureDate': '2026-07-19',
      'photoUrl': 'https://photos.com/store-front.jpg',
      'tags': jsonEncode(['frontage', 'compliance']),
      'notes': encryptedNotes,
      'status': 'DRAFT',
      'version': 1,
      'syncStatus': 'synced',
      'createdAt': DateTime.now().subtract(const Duration(hours: 2)).toIso8601String(),
    });
  }

  String? _decryptNotes(dynamic encryptedNotes) {
    return _cipherCache.decryptNotes(encryptedNotes as String?);
  }

  bool _canSubmit(String currentStatus) {
    return currentStatus == 'DRAFT';
  }

  void _showCreateDialog() {
    _outletIdController.text = 'outlet-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    _captureDateController.text = DateTime.now().toIso8601String().substring(0, 10);
    _photoUrlController.text = 'https://photos.com/new-capture.jpg';
    _tagsController.text = 'display,planogram';
    _notesController.clear();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Capture New Photo'),
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
                  controller: _photoUrlController,
                  decoration: const InputDecoration(labelText: 'Photo URL *'),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Photo URL required';
                    if (!val.startsWith('http://') && !val.startsWith('https://')) {
                      return 'Must be valid URL';
                    }
                    return null;
                  },
                ),
                TextFormField(
                  controller: _tagsController,
                  decoration: const InputDecoration(labelText: 'Tags (comma separated)'),
                ),
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(labelText: 'Notes (encrypted)'),
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
                final encryptedNotes = _cipherCache.encryptNotes(_notesController.text);
                final listTags = _tagsController.text
                    .split(',')
                    .map((t) => t.trim())
                    .where((t) => t.isNotEmpty)
                    .toList();

                setState(() {
                  _localCache.add({
                    'id': 'photo-${DateTime.now().millisecondsSinceEpoch}',
                    'tenantId': widget.tenantId,
                    'agentId': widget.agentId,
                    'outletId': _outletIdController.text,
                    'captureDate': _captureDateController.text,
                    'photoUrl': _photoUrlController.text,
                    'tags': jsonEncode(listTags),
                    'notes': encryptedNotes,
                    'status': 'DRAFT',
                    'version': 1,
                    'syncStatus': _isOnline ? 'synced' : 'pending_insert',
                    'createdAt': DateTime.now().toIso8601String(),
                  });
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(_isOnline ? 'Photo created & synced' : 'Saved offline in queue')),
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
    final decryptedNotes = _decryptNotes(item['notes']);
    final List<dynamic> tagList = jsonDecode(item['tags'] as String);

    _updatePhotoController.text = item['photoUrl'];
    _updateTagsController.text = tagList.join(', ');
    _updateNotesController.text = decryptedNotes ?? '';
    _updateSelectedStatus = currentStatus;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Update Photo Capture'),
          content: SingleChildScrollView(
            child: Form(
              key: _updateFormKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _updatePhotoController,
                    decoration: const InputDecoration(labelText: 'Photo URL *'),
                    enabled: currentStatus == 'DRAFT',
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'Photo URL required';
                      if (!val.startsWith('http://') && !val.startsWith('https://')) {
                        return 'Must be valid URL';
                      }
                      return null;
                    },
                  ),
                  TextFormField(
                    controller: _updateTagsController,
                    decoration: const InputDecoration(labelText: 'Tags (comma separated)'),
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
                      label: const Text('Submit for Verification'),
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
                      const SnackBar(content: Text('Cannot submit — photo is not in DRAFT status')),
                    );
                    return;
                  }

                  final encryptedNotes = _cipherCache.encryptNotes(_updateNotesController.text);
                  final listTags = _updateTagsController.text
                      .split(',')
                      .map((t) => t.trim())
                      .where((t) => t.isNotEmpty)
                      .toList();

                  setState(() {
                    if (currentStatus == 'DRAFT') {
                      item['photoUrl'] = _updatePhotoController.text;
                      item['tags'] = jsonEncode(listTags);
                      item['notes'] = encryptedNotes;
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
                            ? 'Photo submitted for review'
                            : 'Photo updated locally',
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
      SnackBar(content: Text('Sync complete: $synced photo(s) synchronized.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _localCache.where((c) {
      final List<dynamic> tagList = jsonDecode(c['tags'] as String);
      final matchesSearch = _searchTag.isEmpty ||
          tagList.any((t) => t.toString().toLowerCase().contains(_searchTag.toLowerCase()));
      final matchesStatus = _statusFilter == 'all' || c['status'] == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Photo Capture (Offline-First)'),
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
                labelText: 'Search by Tag',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) {
                setState(() {
                  _searchTag = val;
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
                ? const Center(child: Text('No photo captures found. Tap + to add.'))
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (ctx, index) {
                      final item = filtered[index];
                      final decryptedNotes = _decryptNotes(item['notes']);
                      final List<dynamic> tagList = jsonDecode(item['tags'] as String);
                      final isPending = item['syncStatus'] != 'synced';

                      return Card(
                        color: isPending ? Colors.orange.shade50 : null,
                        margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: ListTile(
                          leading: const Icon(Icons.image, size: 40, color: Colors.blue),
                          title: Text('Outlet: ${item['outletId']}'),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Date: ${item['captureDate']}'),
                              Text('URL: ${item['photoUrl']}', maxLines: 1, overflow: TextOverflow.ellipsis),
                              if (tagList.isNotEmpty)
                                Text('Tags: ${tagList.join(', ')}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              if (decryptedNotes != null && decryptedNotes.isNotEmpty)
                                Text('Notes: $decryptedNotes (Decrypted)', style: const TextStyle(fontStyle: FontStyle.italic)),
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
