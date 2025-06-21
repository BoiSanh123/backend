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

// API lấy tất cả đơn từ người gửi cho AssignPickupScreen.js
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
        CONCAT(receiver.Street, ', ', receiver.Ward, ', ', receiver.District, ', ', receiver.City) AS Receiver_address,
        t.Status AS tracking_status,
        t.Timestamp AS tracking_time
      FROM \`Order\` o
      JOIN Service s ON o.Service_id = s.Service_id
      LEFT JOIN Customer sender ON o.Sender_id = sender.CustomerID
      LEFT JOIN Package p ON o.OrderID = p.Order_id
      LEFT JOIN Customer receiver ON p.Receiver_id = receiver.CustomerID
      JOIN (
        SELECT t1.Order_id, t1.Status, t1.Timestamp
        FROM Tracking t1
        INNER JOIN (
          SELECT Order_id, MAX(Timestamp) as LatestTime
          FROM Tracking
          GROUP BY Order_id
        ) latest ON t1.Order_id = latest.Order_id AND t1.Timestamp = latest.LatestTime
      ) t ON o.OrderID = t.Order_id
      WHERE 
        o.Order_status = 'Mới tạo'
        AND t.Status = 'Mới tạo'
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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
/*
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
*/
router.put('/orders/:orderId/status', async (req, res) => {
  try {
    const { newStatus, notes, staffId, proof_image } = req.body;
    console.log('[DEBUG] /orders/:id/status req.body:', req.body);

    // 1. Cập nhật trạng thái đơn hàng
    await db.execute(
      'UPDATE `Order` SET Order_status = ? WHERE OrderID = ?',
      [newStatus, req.params.orderId]
    );

    // 2. Chỉ thêm tracking nếu có staffId (tránh lỗi khi không có)
    if (staffId) {
      await db.execute(
        `INSERT INTO Tracking (Order_id, Staff_id, Notes) 
         VALUES (?, ?, ?)`,
        [req.params.orderId, staffId, notes || null]
      );
    }

    // 3. Xử lý ảnh xác nhận nếu có
    if (proof_image && newStatus === 'Hoàn thành') {
      await db.execute(
        'UPDATE `Order` SET Proof_image = ? WHERE OrderID = ?',
        [proof_image, req.params.orderId]
      );
    }

    res.json({ message: 'Order status updated successfully' });
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

// Cập nhật phí vận chuyển Trong WarehouseProcessingScreen
router.post('/orders/:orderId/package', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { weight, dimensions, current_warehouse_id, ship_cost, item_value = 0 } = req.body;
    const dimensionStr = `${dimensions.length}x${dimensions.width}x${dimensions.height}`;

    await connection.beginTransaction();

    // 1. Lấy thông tin order
    const [order] = await connection.execute(
      `SELECT Sender_id, Service_id FROM \`Order\` WHERE OrderID = ?`,
      [req.params.orderId]
    );

    if (!order.length) {
      throw new Error('Không tìm thấy đơn hàng');
    }

    const senderId = order[0].Sender_id;

    // 2. Tạo package
    const [packageResult] = await connection.execute(
      `INSERT INTO Package (
        Order_id, Sender_id, Receiver_id, Service_id,
        Weight, Dimensions, Value, Current_Warehouse_id, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Đang xử lý')`,
      [
        req.params.orderId,
        order[0].Sender_id,
        order[0].Receiver_id,
        order[0].Service_id,
        parseFloat(weight),
        dimensionStr,
        parseFloat(item_value),
        current_warehouse_id || null
      ]
    );

    // 3. Cập nhật phí vận chuyển
    await connection.execute(
      `UPDATE \`Order\` SET Ship_cost = ? WHERE OrderID = ?`,
      [ship_cost, req.params.orderId]
    );

    // 4. Ghi Tracking: "Đã xử lý"
    await connection.execute(
      `INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp, Location_id)
       VALUES (?, ?, 'Đã xử lý', NOW(), ?)`,
      [
        req.params.orderId,
        senderId, // Tạm gắn sender làm staff xử lý, bạn có thể đổi thành staff thực tế đang xử lý nếu có
        current_warehouse_id
      ]
    );

    await connection.commit();

    res.json({
      message: 'Đã xử lý đơn hàng thành công',
      packageId: packageResult.insertId
    });
  } catch (err) {
    await connection.rollback();
    console.error('Xử lý đơn hàng thất bại:', err);
    res.status(500).json({
      error: err.message || 'Lỗi server khi xử lý đơn hàng'
    });
  } finally {
    connection.release();
  }
});

// Cho WarehouseScreen.js
router.get('/orders/processed', async (req, res) => {
  const { warehouseId } = req.query;

  try {
    const [rows] = await db.execute(`
      SELECT 
        o.OrderID,
        o.Order_code,
        o.Order_status,
        c.Name AS Sender_name,
        s.Service_name,
        p.Weight,
        p.Status AS Package_status
      FROM \`Order\` o
      JOIN Customer c ON o.Sender_id = c.CustomerID
      JOIN Service s ON o.Service_id = s.Service_id
      JOIN Package p ON o.OrderID = p.Order_id
      JOIN (
        SELECT t1.Order_id, t1.Status
        FROM Tracking t1
        INNER JOIN (
          SELECT Order_id, MAX(Timestamp) AS LatestTime
          FROM Tracking
          GROUP BY Order_id
        ) t2 ON t1.Order_id = t2.Order_id AND t1.Timestamp = t2.LatestTime
      ) t ON o.OrderID = t.Order_id
      WHERE 
        o.Order_status = 'Mới tạo' AND
        p.Current_Warehouse_id = ? AND
        t.Status = 'Đã xử lý'
    `, [warehouseId]);

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

// lấy 1 tài xế cụ thể
router.get('/staff/:StaffID', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT Name, Position FROM Staff WHERE StaffID = ?',
      [req.params.StaffID]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[❌ ERROR /staff/:id]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Gán đơn cho tài xế (khi bấm nút "Phân bố")
router.post('/orders/:orderId/assign', async (req, res) => {
  const { StaffID, warehouseId } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lấy tên kho từ warehouseId
    const [warehouse] = await connection.execute(
      'SELECT Name FROM Warehouse WHERE WarehouseID = ?', 
      [warehouseId]
    );

    // 2. Cập nhật TRACKING với tên kho
    await connection.execute(`
      INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp, Location)
      VALUES (?, ?, 'Đang vận chuyển', NOW(), ?)
    `, [req.params.orderId, StaffID, warehouse[0].Name]);

    // 3. Cập nhật PACKAGE
    await connection.execute(`
      UPDATE Package
      SET Status = 'Đang giao'
      WHERE Order_id = ?
    `, [req.params.orderId]);

    await connection.commit();
    res.json({ message: 'Đã giao đơn cho tài xế' });
  } catch (err) {
    await connection.rollback();
    console.error('[❌ ERROR /orders/:orderId/assign]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

// Đếm số đơn đã phân bố cho một tài xế
router.get('/drivers/:StaffID/assigned-count', async (req, res) => {
  try {
    const StaffID = req.params.StaffID;

    const [rows] = await db.execute(`
      SELECT COUNT(DISTINCT t.Order_id) AS count
      FROM Tracking t
      JOIN (
        SELECT Order_id, MAX(Timestamp) AS latest_timestamp
        FROM Tracking
        WHERE Staff_id = ?
        GROUP BY Order_id
      ) latest ON t.Order_id = latest.Order_id AND t.Timestamp = latest.latest_timestamp
      JOIN \`Order\` o ON t.Order_id = o.OrderID
      WHERE t.Staff_id = ?
      AND o.Order_status = 'Mới tạo'
      AND t.Status IN ('Cần lấy', 'Đang lấy', 'Đã lấy', 'Đang vận chuyển')
    `, [StaffID, StaffID]);

    res.json({ count: rows[0].count });
  } catch (err) {
    console.error('[❌ ERROR GET /drivers/:StaffID/assigned-count]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Lấy đơn hàng đã phân bố theo driver cho DriverAssignedOrders và DeliveryOrdersScreen
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
        t.Timestamp,
        t.Status AS Tracking_status,
        t.Notes AS Tracking_notes,
        w.WarehouseID,
        w.Name AS Warehouse_name
      FROM Tracking t
      JOIN \`Order\` o ON t.Order_id = o.OrderID
      JOIN Package p ON o.OrderID = p.Order_id
      JOIN Customer c ON p.Receiver_id = c.CustomerID
      JOIN Service s ON o.Service_id = s.Service_id
      JOIN Warehouse w ON t.Location = w.Name
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

// gán đơn cho tài xế lấy đơn về kho
router.post('/delivery-assignments', async (req, res) => {
  try {
    const { OrderID, StaffID, IsPickup } = req.body;

    const [assignmentResult] = await db.execute(
      'INSERT INTO DeliveryAssignment (OrderID, DriverID, IsPickup) VALUES (?, ?, ?)',
      [OrderID, StaffID, IsPickup]
    );

    await db.execute(
      'INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp) VALUES (?, ?, ?, NOW())',
      [OrderID, StaffID, 'Cần lấy']
    );

    res.json({ success: true, assignmentId: assignmentResult.insertId });
  } catch (err) {
    console.error('[❌ ERROR POST /delivery-assignments]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Lấy tất cả đơn pickup đã được gán cho tài xế kèm status
router.get('/driver-all-pickup-orders', async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({ error: 'Thiếu thông tin driverId' });
    }

    const [orders] = await db.execute(`
      SELECT 
        o.OrderID,
        o.Order_code,
        o.Order_status,
        o.Ship_cost,
        c.Name AS Sender_name,
        c.Phone AS Sender_phone,
        CONCAT(c.Street, ', ', c.Ward, ', ', c.District, ', ', c.City) AS Sender_address,
        s.Service_name,
        t.Status AS tracking_status,
        t.Timestamp AS status_time,
        w.WarehouseID,
        w.Name AS Warehouse_name
      FROM \`Order\` o
      JOIN Customer c ON o.Sender_id = c.CustomerID
      JOIN Service s ON o.Service_id = s.Service_id
      JOIN (
        -- Lấy trạng thái Tracking MỚI NHẤT của mỗi đơn
        SELECT t1.Order_id, t1.Status, t1.Timestamp, t1.Staff_id, t1.Location
        FROM Tracking t1
        INNER JOIN (
          SELECT Order_id, MAX(Timestamp) AS latest_time
          FROM Tracking
          GROUP BY Order_id
        ) t2 ON t1.Order_id = t2.Order_id AND t1.Timestamp = t2.latest_time
      ) t ON o.OrderID = t.Order_id
      LEFT JOIN Warehouse w ON t.Location = w.Name
      WHERE 
        o.Order_status = 'Mới tạo'  -- Chỉ lấy đơn chưa hoàn thành
        AND t.Staff_id = ?          -- Chỉ lấy đơn của tài xế này
      ORDER BY t.Timestamp DESC
    `, [driverId]);

    res.json(orders);
  } catch (err) {
    console.error('[❌ ERROR GET /driver-all-pickup-orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Kiểm tra trạng thái Tracking có "Đang lấy" không
router.get('/driver-active-pickup', async (req, res) => {
  try {
    const { driverId } = req.query;

    const [rows] = await db.execute(`
      SELECT 
        o.OrderID,
        o.Order_code,
        o.Order_status,
        c.Name AS Sender_name,
        c.Phone AS Sender_phone,
        CONCAT(c.Street, ', ', c.Ward, ', ', c.District, ', ', c.City) AS Sender_address,
        s.Service_name
      FROM \`Order\` o
      JOIN Customer c ON o.Sender_id = c.CustomerID
      JOIN Service s ON o.Service_id = s.Service_id
      WHERE o.OrderID IN (
        SELECT t.Order_id 
        FROM Tracking t
        INNER JOIN (
          SELECT Order_id, MAX(Timestamp) as LatestTime
          FROM Tracking
          GROUP BY Order_id
        ) latest ON t.Order_id = latest.Order_id AND t.Timestamp = latest.LatestTime
        WHERE t.Status = 'Đang lấy' AND t.Staff_id = ?
      )
      LIMIT 1
    `, [driverId]);

    res.json(rows[0] || null);
  } catch (err) {
    console.error('[❌ ERROR GET /driver-active-pickup]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cập nhật trạng thái Tracking
router.post('/update-tracking', async (req, res) => {
  try {
    const { orderId, staffId, status } = req.body;

    await db.execute(
      'INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp) VALUES (?, ?, ?, NOW())',
      [orderId, staffId, status]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[❌ ERROR POST /update-tracking]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// lấy danh sách đơn hàng "Mới tạo" có trạng thái tracking mới nhất là "Đã tiếp nhận", lọc dựa theo kho
router.get('/warehouse-new-orders', async (req, res) => {
  const { warehouseId } = req.query;

  try {
    const [rows] = await db.execute(`
      SELECT 
        o.*, 
        s.Service_name,
        CONCAT(sender.Street, ', ', sender.Ward, ', ', sender.District, ', ', sender.City) AS Sender_address,
        CONCAT(receiver.Street, ', ', receiver.Ward, ', ', receiver.District, ', ', receiver.City) AS Receiver_address,
        (
          SELECT t.Status 
          FROM Tracking t
          WHERE t.Order_id = o.OrderID
          ORDER BY t.Timestamp DESC
          LIMIT 1
        ) AS latest_tracking_status,
        (
          SELECT t.Timestamp 
          FROM Tracking t
          WHERE t.Order_id = o.OrderID
          ORDER BY t.Timestamp DESC
          LIMIT 1
        ) AS latest_tracking_timestamp
      FROM \`Order\` o
      JOIN Service s ON o.Service_id = s.Service_id
      JOIN Customer sender ON o.Sender_id = sender.CustomerID
      JOIN Package p ON p.Order_id = o.OrderID
      JOIN Customer receiver ON p.Receiver_id = receiver.CustomerID
      WHERE o.Order_status = 'Mới tạo'
        AND p.Current_Warehouse_id = ?
    `, [warehouseId]);

    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /warehouse-new-orders]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Lấy dannh sách kho
router.get('/warehouses', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT WarehouseID, Name FROM Warehouse
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /warehouses]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Cập nhật kho hiện tại của package
router.post('/deliver-to-warehouse', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { orderId, warehouseId, staffId } = req.body;

    await connection.beginTransaction();

    // 1. Cập nhật package sang kho mới
    await connection.execute(
      `UPDATE Package 
       SET Current_Warehouse_id = ?
       WHERE Order_id = ?`,
      [warehouseId, orderId]
    );

    // 2. Thêm bản ghi tracking
    await connection.execute(
      `INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp, Location)
       VALUES (?, ?, 'Đã tiếp nhận', NOW(), ?)`,
      [orderId, staffId, warehouseId]
    );

    await connection.commit();
    res.json({ message: 'Đã chuyển hàng về kho thành công' });
  } catch (err) {
    await connection.rollback();
    console.error('Lỗi chuyển hàng về kho:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 
router.get('/transfer-drivers', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT StaffID, Name, Phone
      FROM Staff
      WHERE Position = 'Lái xe'
        AND Is_active = TRUE
    `);
    res.json(rows);
  } catch (err) {
    console.error('[❌ ERROR GET /transfer-drivers]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API gán đơn cho lái xe chuyển Kho
router.post('/orders/:orderId/assign-transfer', async (req, res) => {
  try {
    const { StaffID, warehouseId, warehouseName, warehouseAddress } = req.body;

    if (!StaffID || !warehouseId || !warehouseName || !warehouseAddress) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    await db.execute(`
      INSERT INTO Tracking (Order_id, Staff_id, Status, Timestamp, Location, Notes)
      VALUES (?, ?, 'Đang chuyển kho', NOW(), ?, ?)
    `, [
      req.params.orderId,
      StaffID,
      warehouseName,
      `Địa chỉ kho đến: ${warehouseAddress}`
    ]);

    res.json({ message: 'Đã phân bố đơn cho lái xe chuyển kho' });
  } catch (err) {
    console.error('[❌ ERROR POST /orders/:orderId/assign-transfer]:', err);
    res.status(500).json({ error: 'Internal Server Error' });
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
