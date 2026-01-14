-- KEYS[1]: voucher_stock_key (Ví dụ: voucher:SALE100:stock)
-- KEYS[2]: voucher_users_key (Ví dụ: voucher:SALE100:users)
-- ARGV[1]: user_id (Ví dụ: user_123)
-- ARGV[2]: user_limit (Ví dụ: 1 - mỗi người chỉ được 1 vé)

local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then
    return -1 -- Lỗi: Voucher không tồn tại trong cache
end

if stock <= 0 then
    return 0 -- Lỗi: Hết hàng
end

-- Kiểm tra xem user này đã lấy chưa
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then
    return -2 -- Lỗi: Bạn đã lưu voucher này rồi
end

-- Kiểm tra giới hạn số lượng (nếu user_limit > 1) - Ở đây làm đơn giản là check Set
-- Nếu OK thì trừ kho và lưu user
redis.call('DECR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])

return 1 -- Thành công