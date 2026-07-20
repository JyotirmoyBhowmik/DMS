import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

/// Drift table for local CompetitorCapture offline cache.
/// Supports tombstones, versions, and encrypted PII/sensitive fields.
class LocalCompetitorCaptures extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get outletId => text()();
  TextColumn get captureDate => text()(); // ISO Date YYYY-MM-DD
  TextColumn get brand => text()();
  TextColumn get skuId => text()();
  IntColumn get observedPriceCents => integer()();
  TextColumn get promotionDetails => text().nullable()(); // Encrypted sensitive details
  TextColumn get photoUrl => text().nullable()();
  TextColumn get notes => text().nullable()(); // Encrypted PII observations
  TextColumn get status => text().withDefault(const Constant('DRAFT'))(); // 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  IntColumn get version => integer().withDefault(const Constant(0))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update' | 'tombstone'
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

/// Handles AES-GCM encryption/decryption for PII and sensitive fields in CompetitorCapture.
class EncryptedCompetitorCaptureCache {
  final Uint8List _encryptionKey;

  EncryptedCompetitorCaptureCache(this._encryptionKey);

  /// Encrypt sensitive fields before storing locally.
  Map<String, dynamic> encryptFields({
    String? promotionDetails,
    String? notes,
  }) {
    final result = <String, dynamic>{};

    if (promotionDetails != null && promotionDetails.isNotEmpty) {
      final encryptedPromo = AesGcmCipher.pack(
        AesGcmCipher.encrypt(
          Uint8List.fromList(utf8.encode(promotionDetails)),
          _encryptionKey,
        ),
      );
      result['promotionDetails'] = encryptedPromo;
    }

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

  /// Decrypt sensitive fields after reading from local cache.
  Map<String, String?> decryptFields({
    String? encryptedPromo,
    String? encryptedNotes,
  }) {
    final result = <String, String?>{};

    if (encryptedPromo != null && encryptedPromo.isNotEmpty) {
      try {
        final decryptedPromo = utf8.decode(
          AesGcmCipher.decrypt(
            AesGcmCipher.unpack(encryptedPromo),
            _encryptionKey,
          ),
        );
        result['promotionDetails'] = decryptedPromo;
      } catch (_) {
        result['promotionDetails'] = null;
      }
    } else {
      result['promotionDetails'] = null;
    }

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
        result['notes'] = null;
      }
    } else {
      result['notes'] = null;
    }

    return result;
  }
}
