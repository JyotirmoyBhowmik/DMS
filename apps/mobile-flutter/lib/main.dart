import 'package:flutter/material.dart';
import 'screens/attendance_screen.dart';
import 'screens/competitor_capture_screen.dart';
import 'screens/delivery_confirmation_screen.dart';
import 'screens/geo_checkin_screen.dart';
import 'screens/merchandising_audit_screen.dart';
import 'screens/outlet_census_screen.dart';
import 'screens/photo_capture_screen.dart';
import 'screens/van_sale_screen.dart';

const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://api.dms.jyotirmoyb.com');
const String webAdminUrl = String.fromEnvironment('WEB_ADMIN_URL', defaultValue: 'https://dms.jyotirmoyb.com');

void main() {
  runApp(const SfaApp());
}

class SfaApp extends StatelessWidget {
  const SfaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Field SFA Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E3A8A),
          brightness: Brightness.dark,
        ),
      ),
      home: const SfaDashboard(
        agentId: 'rep-001',
        tenantId: 'tenant-uuid-1111',
      ),
    );
  }
}

class SfaDashboard extends StatefulWidget {
  final String agentId;
  final String tenantId;

  const SfaDashboard({
    super.key,
    required this.agentId,
    required this.tenantId,
  });

  @override
  State<SfaDashboard> createState() => _SfaDashboardState();
}

class _SfaDashboardState extends State<SfaDashboard> {
  int _currentIndex = 0;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      GeoCheckInScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      AttendanceScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      VanSaleScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      PhotoCaptureScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      OutletCensusScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      MerchandisingAuditScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      DeliveryConfirmationScreen(agentId: widget.agentId, tenantId: widget.tenantId),
      CompetitorCaptureScreen(agentId: widget.agentId, tenantId: widget.tenantId),
    ];
  }

  final List<NavigationDestination> _destinations = const [
    NavigationDestination(icon: Icon(Icons.location_on), label: 'Check-In'),
    NavigationDestination(icon: Icon(Icons.access_time), label: 'Attendance'),
    NavigationDestination(icon: Icon(Icons.local_shipping), label: 'Van Sale'),
    NavigationDestination(icon: Icon(Icons.camera_alt), label: 'Photo'),
    NavigationDestination(icon: Icon(Icons.store), label: 'Census'),
    NavigationDestination(icon: Icon(Icons.assessment), label: 'Audit'),
    NavigationDestination(icon: Icon(Icons.local_post_office), label: 'Delivery'),
    NavigationDestination(icon: Icon(Icons.trending_up), label: 'Competitor'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: _destinations,
      ),
    );
  }
}

