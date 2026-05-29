import 'package:flutter/material.dart';

void main() {
  runApp(const SfaApp());
}

class SfaApp extends StatelessWidget {
  const SfaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Field SFA Platform',
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF1E3A8A),
      ),
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Enterprise DMS & SFA'),
        ),
        body: const Center(
          child: Text(
            'Offline Synchronization Sync Service Active',
            style: TextStyle(fontSize: 16, color: Colors.green),
          ),
        ),
      ),
    );
  }
}
