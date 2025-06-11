// File: routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// 1. Tạo đơn hàng mới
router.post('/orders', async (req, res) => {
  try {
    const {
      sender_id,
      service_id,
      total_package,
      total_weight,
      ship_cost,
      payment_status
    } = req.body;

    console.log('[DEBUG] /orders req.body:', req.body);

    const [result] = await db.execute(
      'INSERT INTO `Order` (Order_code, Sender_id, Service_id, Total_package, Total_weight, Ship_cost, Payment_status, Order_status) VALUES (?, ?, ?, ?, ?, ?, ?, "Mới tạo")',
      [
        'ORD' + Date.now(),
        sender_id,
        service_id,
        total_package,
        total_weight,
        ship_cost,
        payment_status
      ]
    );
    res.json({ orderId: result.insertId });
  } catch (err) {
    console.error('[❌ ERROR /orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// [NEW] Lấy tất cả đơn hàng
/*router.get('/orders', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT o.*, s.Service_name
      FROM \`Order\` o
      JOIN Service s ON o.Service_id = s.Service_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}); */

router.get('/orders', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        o.*,
        s.Service_name,
        sender.Name AS Sender_name,
        sender.Phone AS Sender_phone,
        CONCAT(sender.Street, ', ', sender.Ward, ', ', sender.District, ', ', sender.City) AS Sender_address,
        receiver.Name AS Receiver_name,
        receiver.Phone AS Receiver_phone,
        CONCAT(receiver.Street, ', ', receiver.Ward, ', ', receiver.District, ', ', receiver.City) AS Receiver_address
      FROM \`Order\` o
      JOIN Service s ON o.Service_id = s.Service_id
      LEFT JOIN Customer sender ON o.Sender_id = sender.CustomerID
      LEFT JOIN Package p ON o.OrderID = p.Order_id
      LEFT JOIN Customer receiver ON p.Receiver_id = receiver.CustomerID
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



/*
router.get('/orders', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM `Order`');
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}); 
*/

// 2. Lấy danh sách đơn hàng của một khách hàng
router.get('/orders/customer/:customerId', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM `Order` WHERE Sender_id = ?',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR /orders/customer/:id]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Cập nhật trạng thái đơn hàng dựa bảng Order 'Mới tạo', 'Đang giao', 'Hoàn thành', 'Thất bại'
router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { newStatus } = req.body;
    console.log('[DEBUG] /orders/:id/status req.body:', req.body);

    await db.execute(
      'UPDATE `Order` SET Order_status = ? WHERE OrderID = ?',
      [newStatus, req.params.orderId]
    );

    res.json({ message: 'Order status updated' });
  } catch (err) {
    console.error('[❌ ERROR /orders/:id/status]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Thêm gói hàng vào đơn hàng
router.post('/packages', async (req, res) => {
  try {
    const {
      order_id,
      sender_id,
      receiver_id,
      service_id,
      weight,
      dimensions,
      value,
      current_warehouse_id,
      status
    } = req.body;

    console.log('[DEBUG] /packages req.body:', req.body);

    const [result] = await db.execute(
      'INSERT INTO Package (Order_id, Sender_id, Receiver_id, Service_id, Weight, Dimensions, Value, Current_Warehouse_id, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        order_id,
        sender_id,
        receiver_id,
        service_id,
        weight,
        dimensions,
        value,
        current_warehouse_id,
        status
      ]
    );
    res.json({ packageId: result.insertId });
  } catch (err) {
    console.error('[❌ ERROR /packages]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// [NEW] Lấy tất cả gói hàng
router.get('/packages', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM Package');
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /packages]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Tạo tracking mới cho đơn hàng
router.post('/tracking', async (req, res) => {
  try {
    const { order_id, staff_id, status, location, timestamp, notes } = req.body;

    console.log('[DEBUG] /tracking req.body:', req.body);

    const [result] = await db.execute(
      'INSERT INTO Tracking (Order_id, Staff_id, Status, Location, Timestamp, Notes) VALUES (?, ?, ?, ?, ?, ?)',
      [order_id, staff_id, status, location, timestamp, notes]
    );
    res.json({ trackingId: result.insertId });
  } catch (err) {
    console.error('[❌ ERROR /tracking]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// [NEW] Lấy tất cả tracking
router.get('/tracking', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM Tracking');
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /tracking]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Tạo gói hàng + Cập nhật phí vận chuyển (cho WarehouseScreen lấy api đã lưu Trong WarehouseProcessingScreen)
router.post('/orders/:orderId/package', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      weight,
      dimensions,
      value, // không dùng
      current_warehouse_id,
      sender_id,
      receiver_id,
      service_id,
      ship_cost
    } = req.body;

    const dimensionStr = `${dimensions.length}x${dimensions.width}x${dimensions.height}`;

    await connection.beginTransaction();

    // 1. Tạo gói hàng trong bảng Package
    const [packageResult] = await connection.execute(
      `INSERT INTO Package (
        Order_id, Sender_id, Receiver_id, Service_id,
        Weight, Dimensions, Value, Current_Warehouse_id, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Đang xử lý')`,
      [
        req.params.orderId,
        sender_id,
        receiver_id,
        service_id,
        weight,
        dimensionStr,
        value,
        current_warehouse_id || null
      ]
    );

    // 2. Cập nhật phí vận chuyển vào bảng Order
    await connection.execute(
      `UPDATE \`Order\` SET Ship_cost = ? WHERE OrderID = ?`,
      [ship_cost, req.params.orderId]
    );

    await connection.commit();

    res.json({
      message: '✅ Đã lưu gói hàng và cập nhật phí vận chuyển',
      packageId: packageResult.insertId
    });
  } catch (err) {
    await connection.rollback();
    console.error('[❌ ERROR /orders/:id/package]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

// GET /orders/processed là cho WarehouseScreen.js
router.get('/orders/processed', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        o.OrderID,
        o.Order_code,
        o.Sender_id,
        c.Name AS Sender_name,
        s.Service_name,
        p.Weight,
        p.Dimensions,
        p.Value,
        o.Ship_cost
      FROM \`Order\` o
      LEFT JOIN Customer c ON o.Sender_id = c.CustomerID
      LEFT JOIN Service s ON o.Service_id = s.Service_id
      INNER JOIN Package p ON o.OrderID = p.Order_id
      WHERE o.Order_status != 'Mới tạo'
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /orders/processed]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Lấy danh sách tài xế
router.get('/drivers', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT StaffID AS StaffID, Name, Phone 
      FROM Staff
      WHERE Position = 'Nhân viên vận chuyển'
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /drivers]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Gán đơn cho tài xế (khi bấm nút "Phân bố")
router.post('/orders/:orderId/assign', async (req, res) => {
  const { StaffID } = req.body;

  try {
    await db.execute(`
      INSERT INTO Tracking (Order_id, Staff_id, Status, Location, Timestamp)
      VALUES (?, ?, 'Đã tiếp nhận', 'Kho hiện tại', NOW())
    `, [req.params.orderId, StaffID]);
    // Cập nhật trạng thái đơn
    await db.execute(`
      UPDATE \`Order\` SET Order_status = 'Đang giao'
      WHERE OrderID = ?
    `, [req.params.orderId]);

    res.json({ message: '✅ Đã phân bố đơn hàng cho tài xế' });
  } catch (err) {
    console.error('[❌ ERROR /orders/:orderId/assign]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Đếm số đơn đã phân bố cho một tài xế
router.get('/drivers/:StaffID/assigned-count', async (req, res) => {
  try {
    const StaffID = req.params.StaffID;

    const [rows] = await db.execute(`
      SELECT COUNT(*) AS count
      FROM Tracking
      WHERE Staff_id = ?
    `, [StaffID]);

    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('[❌ ERROR GET /drivers/:StaffID/assigned-count]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Lấy đơn hàng đã phân bố theo driver cho DriverAssignedOrders

router.get('/drivers/:StaffID/assigned-orders', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        o.OrderID,
        o.Order_code,
        o.Order_status,
        o.Ship_cost,
        s.Service_name,  
        p.Receiver_id,
        p.Weight,
        c.Name AS Receiver_name,
        c.Phone AS Receiver_phone,
        CONCAT(c.Street, ', ', c.Ward, ', ', c.District, ', ', c.City) AS Receiver_address,
        t.Timestamp AS assigned_at
      FROM Tracking t
      JOIN \`Order\` o ON t.Order_id = o.OrderID
      JOIN Package p ON o.OrderID = p.Order_id
      JOIN Customer c ON p.Receiver_id = c.CustomerID
      JOIN Service s ON o.Service_id = s.Service_id  
      WHERE t.Staff_id = ?
      ORDER BY t.Timestamp DESC
    `, [req.params.StaffID]);

    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /drivers/:StaffID/assigned-orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Hủy phân bố đơn cho DriverAssignedOrders.js
router.put('/orders/:orderId/unassign', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Kiểm tra trạng thái đơn hàng
    const [order] = await connection.execute(
      `SELECT Order_status FROM \`Order\` WHERE OrderID = ?`,
      [req.params.orderId]
    );

    if (!order[0]) {
      throw new Error('Đơn hàng không tồn tại');
    }

    if (order[0].Order_status === 'Đang giao') {
      throw new Error('Không thể hủy phân bố đơn hàng đang giao');
    }

    // 2. Cập nhật trạng thái đơn về "Đã hủy phân bố"
    await connection.execute(
      `UPDATE \`Order\` SET Order_status = 'Đã hủy phân bố' 
       WHERE OrderID = ?`,
      [req.params.orderId]
    );

    // 3. Thêm bản ghi tracking
    await connection.execute(
      `INSERT INTO Tracking (Order_id, Status, Timestamp, Notes)
       VALUES (?, 'Đã hủy phân bố', NOW(), 'Hủy phân bố bởi tài xế')`,
      [req.params.orderId]
    );

    // 4. Xóa liên kết với tài xế
    await connection.execute(
      `DELETE FROM Tracking 
       WHERE Order_id = ? AND Status = 'Mới tạo'`,
      [req.params.orderId]
    );

    await connection.commit();
    res.json({ message: 'Đã hủy phân bố đơn hàng' });
  } catch (err) {
    await connection.rollback();
    console.error('[❌ ERROR /orders/:orderId/unassign]:', err);
    res.status(400).json({ error: err.message || 'Hủy phân bố thất bại' });
  } finally {
    connection.release();
  }
});

// POST /shipping/calculate
const {
  geocodeCity,
  determineRegion,
  isUrbanDistrict,
  calculatePrice,
  getDistance,
} = require('./ShippingFee');

router.post('/shipping/calculate', async (req, res) => {
  try {
    const { from, to, weight, itemValue, serviceName } = req.body;

    const fromLoc = await geocodeCity(from);
    const toLoc = await geocodeCity(to);
    const { distanceKm } = await getDistance(fromLoc.coords, toLoc.coords);
    const region = determineRegion(fromLoc.province, toLoc.province);
    const isUrban = isUrbanDistrict(toLoc.locality);

    const chargeableWeight = Math.max(parseFloat(weight), 0.1);
    const fee = calculatePrice(region, chargeableWeight, [], isUrban, itemValue || 0);
    let total = fee.total;

    if (serviceName === 'Hỏa tốc') {
      total *= 1.5;
    }

    res.json({
      total: Math.round(total),
      distance: distanceKm,
      regionType: region
    });
  } catch (err) {
    console.error('[❌ ERROR /shipping/calculate]:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
