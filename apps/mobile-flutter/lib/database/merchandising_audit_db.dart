import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

/// Drift table for local MerchandisingAudit offline cache.
/// Supports tombstones, versions, and encrypted PII columns.
class LocalMerchandisingAudits extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get outletId => text()();
  TextColumn get visitId => text().nullable()();
  TextColumn get auditDate => text()(); // ISO date YYYY-MM-DD
  TextColumn get shelfPhotosJson => text().withDefault(const Constant('[]'))(); // JSON array
  IntColumn get planogramCompliance => integer().withDefault(const Constant(0))();
  TextColumn get shelfShareByBrandJson => text().withDefault(const Constant('[]'))();
  TextColumn get outOfStockSkusJson => text().withDefault(const Constant('[]'))();
  TextColumn get pricingAuditJson => text().withDefault(const Constant('[]'))();
  IntColumn get displayScore => integer().withDefault(const Constant(0))();
  TextColumn get notes => text().nullable()(); // Encrypted PII observations
  TextColumn get status => text().withDefault(const Constant('DRAFT'))(); // 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  IntColumn get version => integer().withDefault(const Constant(0))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Handles AES-GCM encryption/decryption for PII fields in MerchandisingAudit.
class EncryptedMerchandisingAuditCache {
  final Uint8List _encryptionKey;

  EncryptedMerchandisingAuditCache(this._encryptionKey);

  /// Encrypt PII fields before storing locally.
  Map<String, dynamic> encryptFields({
    String? notes,
  }) {
    final result = <String, dynamic>{};

    if (notes != null && notes.isNotEmpty) {
      final encryptedNotes = AesGcmCipher.pack(
        AesGcmCipher.encrypt(
          Uint8List.fromList(utf8.encode(notes)),
          _encryptionKey,
        ),
      );
      result['notes'] = encryptedNotes;
    }

    return result;
  }

  /// Decrypt PII fields after reading from local cache.
  Map<String, String?> decryptFields({
    String? encryptedNotes,
  }) {
    final result = <String, String?>{};

    if (encryptedNotes != null && encryptedNotes.isNotEmpty) {
      try {
        final decryptedNotes = utf8.decode(
          AesGcmCipher.decrypt(
            AesGcmCipher.unpack(encryptedNotes),
            _encryptionKey,
          ),
        );
        result['notes'] = decryptedNotes;
      } catch (_) {
        result['notes'] = null; // Decryption failure — return null safely
      }
    } else {
      result['notes'] = null;
    }

    return result;
  }
}
