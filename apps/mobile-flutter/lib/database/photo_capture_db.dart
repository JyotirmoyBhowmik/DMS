import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

/// Drift table for local PhotoCapture offline caching.
class LocalPhotoCaptures extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get outletId => text()();
  TextColumn get captureDate => text()(); // YYYY-MM-DD
  TextColumn get photoUrl => text()();
  TextColumn get tags => text()(); // JSON string array
  TextColumn get notes => text().nullable()(); // Encrypted sensitive notes
  TextColumn get status => text().withDefault(const Constant('DRAFT'))(); // 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  IntColumn get version => integer().withDefault(const Constant(0))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Helper class for encryption and decryption of local PhotoCapture cache.
class EncryptedPhotoCaptureCache {
  final Uint8List _encryptionKey;

  EncryptedPhotoCaptureCache(this._encryptionKey);

  /// Encrypt sensitive notes field.
  String? encryptNotes(String? notes) {
    if (notes == null || notes.isEmpty) return null;
    return AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(notes)),
        _encryptionKey,
      ),
    );
  }

  /// Decrypt sensitive notes field.
  String? decryptNotes(String? encryptedNotes) {
    if (encryptedNotes == null || encryptedNotes.isEmpty) return null;
    try {
      return utf8.decode(
        AesGcmCipher.decrypt(
          AesGcmCipher.unpack(encryptedNotes),
          _encryptionKey,
        ),
      );
    } catch (_) {
      return null;
    }
  }
}
