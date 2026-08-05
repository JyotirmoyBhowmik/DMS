import 'package:drift/drift.dart';
import 'dart:convert';
import '../crypto/aes_gcm_cipher.dart';

class LocalAttendances extends Table {
  TextColumn get id => text()();
  TextColumn get tenantId => text()();
  TextColumn get agentId => text()();
  TextColumn get date => text()();
  DateTimeColumn get checkInTime => dateTime().nullable()();
  DateTimeColumn get checkOutTime => dateTime().nullable()();
  TextColumn get status => text()(); // 'absent' | 'checked_in' | 'checked_out' | 'leave'
  TextColumn get leaveType => text().nullable()();
  IntColumn get version => integer().withDefault(const Constant(1))();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))(); // 'synced' | 'pending_insert' | 'pending_update'

  @override
  Set<Column> get primaryKey => {id};
}

/// Helper service for encrypting and decrypting LocalAttendance data at rest.
class EncryptedAttendanceCache {
  final Uint8List _encryptionKey;

  EncryptedAttendanceCache(this._encryptionKey);

  /// Encrypts sensitive fields (like agentId and leaveType) before storing them at rest.
  Map<String, dynamic> encryptFields(String agentId, String? leaveType) {
    final encryptedAgentId = AesGcmCipher.pack(
      AesGcmCipher.encrypt(
        Uint8List.fromList(utf8.encode(agentId)),
        _encryptionKey,
      ),
    );

    String? encryptedLeaveType;
    if (leaveType != null) {
      encryptedLeaveType = AesGcmCipher.pack(
        AesGcmCipher.encrypt(
          Uint8List.fromList(utf8.encode(leaveType)),
          _encryptionKey,
        ),
      );
    }

    return {
      'agentId': encryptedAgentId,
      'leaveType': encryptedLeaveType,
    };
  }

  /// Decrypts sensitive fields retrieved from local cache database.
  Map<String, String?> decryptFields(String encryptedAgentId, String? encryptedLeaveType) {
    final decryptedAgentId = utf8.decode(
      AesGcmCipher.decrypt(
        AesGcmCipher.unpack(encryptedAgentId),
        _encryptionKey,
      ),
    );

    String? decryptedLeaveType;
    if (encryptedLeaveType != null) {
      decryptedLeaveType = utf8.decode(
        AesGcmCipher.decrypt(
          AesGcmCipher.unpack(encryptedLeaveType),
          _encryptionKey,
        ),
      );
    }

    return {
      'agentId': decryptedAgentId,
      'leaveType': decryptedLeaveType,
    };
  }
}
