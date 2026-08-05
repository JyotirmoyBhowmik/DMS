import 'package:flutter/material.dart';

enum ChannelType {
  mart,
  hotelRestaurant,
  smallShop,
  vanOperator,
  salesMarketingInternal,
}

class ChannelModuleRouterScreen extends StatefulWidget {
  const ChannelModuleRouterScreen({super.key});

  @override
  State<ChannelModuleRouterScreen> createState() => _ChannelModuleRouterScreenState();
}

class _ChannelModuleRouterScreenState extends State<ChannelModuleRouterScreen> {
  ChannelType _selectedChannel = ChannelType.smallShop;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Channel SFA Module Selector'),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Channel Selector Pills
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            color: const Color(0xFFF8FAFC),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildChannelPill(ChannelType.smallShop, 'Kirana / Small Shop', Icons.storefront),
                  _buildChannelPill(ChannelType.mart, 'Modern Trade / Mart', Icons.shopping_cart),
                  _buildChannelPill(ChannelType.hotelRestaurant, 'HORECA / Hospitality', Icons.restaurant),
                  _buildChannelPill(ChannelType.vanOperator, 'Van Sales / Delivery', Icons.local_shipping),
                  _buildChannelPill(ChannelType.salesMarketingInternal, 'Internal Sample / Promo', Icons.campaign),
                ],
              ),
            ),
          ),

          // Active Channel View
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: _buildChannelView(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChannelPill(ChannelType type, String label, IconData icon) {
    final isSelected = _selectedChannel == type;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: FilterChip(
        avatar: Icon(icon, size: 18, color: isSelected ? Colors.white : const Color(0xFF2563EB)),
        label: Text(label),
        selected: isSelected,
        onSelected: (bool selected) {
          if (selected) {
            setState(() {
              _selectedChannel = type;
            });
          }
        },
        selectedColor: const Color(0xFF2563EB),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : const Color(0xFF1E293B),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildChannelView() {
    switch (_selectedChannel) {
      case ChannelType.mart:
        return _buildMartChannelView();
      case ChannelType.hotelRestaurant:
        return _buildHorecaChannelView();
      case ChannelType.smallShop:
        return _buildSmallShopChannelView();
      case ChannelType.vanOperator:
        return _buildVanOperatorChannelView();
      case ChannelType.salesMarketingInternal:
        return _buildInternalSalesChannelView();
    }
  }

  // 1. MART / MODERN TRADE SCREEN
  Widget _buildMartChannelView() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.shopping_cart, color: Color(0xFF2563EB), size: 28),
                SizedBox(width: 12),
                Text('Mart & Supermarket Bulk Order Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Optimized for large format retail stores, pallet-level ordering, and barcode-based inventory audits.'),
            const Divider(height: 24),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan Pallet / Barcode EAN'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.camera_alt),
              label: const Text('Audit Shelf Display & Share of Shelf'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  // 2. HORECA (HOTEL / RESTAURANT) SCREEN
  Widget _buildHorecaChannelView() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.restaurant, color: Color(0xFFD97706), size: 28),
                SizedBox(width: 12),
                Text('HORECA Contract Supply Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Contract pricing rules, recurring delivery schedules, and institutional bulk invoicing.'),
            const Divider(height: 24),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.receipt_long),
              label: const Text('Issue Contract Supply Order'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706), foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  // 3. SMALL SHOP / KIRANA SCREEN
  Widget _buildSmallShopChannelView() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.storefront, color: Color(0xFF166534), size: 28),
                SizedBox(width: 12),
                Text('Kirana Quick Order & Cash Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Fast 3-tap order entry, scheme popups, and instant digital cash receipt.'),
            const Divider(height: 24),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.flash_on),
              label: const Text('Quick Order (Top 10 SKUs)'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF166534), foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  // 4. VAN OPERATOR SCREEN
  Widget _buildVanOperatorChannelView() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.local_shipping, color: Color(0xFF7C3AED), size: 28),
                SizedBox(width: 12),
                Text('Van Sales & Thermal Print Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Spot sales from van stock ledger, instant invoicing, and Bluetooth thermal printer integration.'),
            const Divider(height: 24),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.print),
              label: const Text('Issue Spot Invoice & Thermal Print'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  // 5. INTERNAL SALES / MARKETING SCREEN
  Widget _buildInternalSalesChannelView() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.campaign, color: Color(0xFFDC2626), size: 28),
                SizedBox(width: 12),
                Text('Internal Sample & Promo Module', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Sample distribution logging, promotional audit verification, and marketing budget tracking.'),
            const Divider(height: 24),
            ElevatedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.card_giftcard),
              label: const Text('Issue Free Sample Receipt'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
