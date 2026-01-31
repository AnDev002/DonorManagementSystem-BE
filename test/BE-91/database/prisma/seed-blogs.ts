// File: src/database/prisma/seed-blogs.ts

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load biến môi trường
dotenv.config();

const prisma = new PrismaClient();

// 1. Dữ liệu Danh mục Blog (BlogCategory)
const BLOG_CATEGORY_SEEDS = [
  { name: "Công Nghệ", slug: "cong-nghe" },
  { name: "Thời Trang", slug: "thoi-trang" },
  { name: "Sắc Đẹp", slug: "sac-dep" },
  { name: "Đời Sống", slug: "doi-song" },
  { name: "Ẩm Thực", slug: "am-thuc" },
  { name: "Du Lịch", slug: "du-lich" },
  { name: "Sách", slug: "sach" },
  { name: "Khác", slug: "khac" }
];

// 2. Dữ liệu Bài viết (BlogContent)
const BLOG_SEEDS = [
  // --- NHÓM CÔNG NGHỆ (TECH) ---
  {
    title: "Trí tuệ nhân tạo (AI) năm 2026: Xu hướng và Tác động đến Lập trình viên",
    slug: "tri-tue-nhan-tao-ai-nam-2026-xu-huong-va-tac-dong",
    content: "<h3>Sự bùng nổ của Generative AI</h3><p>Năm 2026 đánh dấu một bước ngoặt lớn khi Generative AI không còn là công cụ thử nghiệm mà đã trở thành trợ lý đắc lực trong quy trình phát triển phần mềm. Các công cụ như GitHub Copilot X hay GPT-5 đang thay đổi cách chúng ta viết code.</p><h3>Tác động đến thị trường việc làm IT</h3><ul><li><b>Tự động hóa coding:</b> Các tác vụ boilerplate code được AI xử lý 90%.</li><li><b>Nhu cầu kỹ năng mới:</b> Kỹ năng Prompt Engineering và tư duy kiến trúc hệ thống trở nên quan trọng hơn việc nhớ cú pháp.</li><li><b>Bảo mật:</b> AI giúp phát hiện lỗ hổng bảo mật nhanh hơn nhưng cũng tạo ra các cuộc tấn công tinh vi hơn.</li></ul><h3>Kết luận</h3><p>Lập trình viên không nên lo sợ bị thay thế, mà hãy học cách làm chủ AI để tăng năng suất làm việc gấp nhiều lần.</p>",
    thumbnail: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000",
    catSlug: "cong-nghe",
    keywords: ["trí tuệ nhân tạo", "AI 2026", "lập trình viên", "công nghệ thông tin", "tương lai AI"],
    metaDesc: "Khám phá xu hướng Trí tuệ nhân tạo (AI) năm 2026 và những tác động sâu rộng của nó đối với công việc của lập trình viên và ngành IT."
  },
  {
    title: "Đánh giá MacBook Pro M3 Max: Quái vật hiệu năng cho Designer và Coder",
    slug: "danh-gia-macbook-pro-m3-max",
    content: "<h3>Thiết kế và Màn hình</h3><p>MacBook Pro M3 Max vẫn giữ nguyên ngôn ngữ thiết kế sang trọng nhưng bổ sung màu Space Black mới cực kỳ cuốn hút, hạn chế bám vân tay. Màn hình Liquid Retina XDR tiếp tục là chuẩn mực của ngành.</p><h3>Hiệu năng thực tế</h3><p>Với chip M3 Max quy trình 3nm:</p><ul><li>Render video 8K nhanh hơn 20% so với M2 Max.</li><li>Build dự án Docker phức tạp chỉ trong tích tắc.</li><li>Khả năng Ray Tracing phần cứng hỗ trợ tốt cho việc phát triển game.</li></ul><h3>Có đáng nâng cấp?</h3><p>Nếu bạn đang dùng M1 hoặc Intel, đây là bản nâng cấp đáng giá từng xu. Tuy nhiên, người dùng M2 Max có thể chưa cần thiết phải lên đời ngay lập tức.</p>",
    thumbnail: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?auto=format&fit=crop&q=80&w=1000",
    catSlug: "cong-nghe",
    keywords: ["MacBook Pro M3", "Apple M3 Max", "laptop lập trình", "review công nghệ", "laptop đồ họa"],
    metaDesc: "Review chi tiết MacBook Pro M3 Max. Liệu hiệu năng của con chip 3nm mới có xứng đáng để các Designer và Developer xuống tiền nâng cấp?"
  },
  {
    title: "5 Ngôn ngữ lập trình đáng học nhất năm 2026 cho người mới bắt đầu",
    slug: "5-ngon-ngu-lap-trinh-dang-hoc-nhat-2026",
    content: "<h3>1. JavaScript / TypeScript</h3><p>Vẫn là vua của Web Development. TypeScript đang dần trở thành tiêu chuẩn bắt buộc cho các dự án lớn nhờ khả năng kiểm soát lỗi tốt.</p><h3>2. Python</h3><p>Ngôn ngữ của AI và Data Science. Cú pháp đơn giản, thư viện phong phú giúp Python giữ vững vị trí top đầu.</p><h3>3. Rust</h3><p>Được yêu thích nhất trong nhiều năm liền. Hiệu năng cao, an toàn bộ nhớ, Rust đang được sử dụng nhiều trong Blockchain và System Programming.</p><h3>4. Go (Golang)</h3><p>Lựa chọn hàng đầu cho Backend và Microservices nhờ khả năng xử lý đồng thời (concurrency) tuyệt vời.</p><h3>5. Swift</h3><p>Cánh cửa độc quyền để bước vào hệ sinh thái ứng dụng iOS/macOS của Apple.</p>",
    thumbnail: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=1000",
    catSlug: "cong-nghe",
    keywords: ["học lập trình", "ngôn ngữ lập trình 2026", "javascript", "python", "hướng nghiệp IT"],
    metaDesc: "Top 5 ngôn ngữ lập trình tiềm năng nhất 2026 giúp người mới bắt đầu định hướng nghề nghiệp và tối ưu hóa thu nhập trong ngành công nghệ."
  },

  // 2. THỜI TRANG
  {
    title: "Phong cách Minimalism: Khi sự tối giản lên ngôi trong tủ đồ",
    slug: "phong-cach-minimalism-toi-gian-len-ngoi",
    content: "<h3>Minimalism là gì?</h3><p>Phong cách tối giản không chỉ là mặc đồ đen trắng. Đó là nghệ thuật loại bỏ những chi tiết thừa thãi, tập trung vào phom dáng, chất liệu và sự tinh tế.</p><h3>Cách xây dựng tủ đồ Capsule</h3><ul><li><b>Áo thun basic:</b> Chọn chất liệu cotton 100%, form dáng vừa vặn.</li><li><b>Quần Jeans/Trouser:</b> Màu trung tính như đen, be, xanh navy.</li><li><b>Blazer:</b> Item 'thần thánh' nâng tầm mọi set đồ.</li></ul><h3>Lợi ích của sự tối giản</h3><p>Giúp bạn tiết kiệm thời gian chọn đồ mỗi sáng, bảo vệ môi trường và luôn giữ được vẻ ngoài thanh lịch, sang trọng.</p>",
    thumbnail: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1000",
    catSlug: "thoi-trang",
    keywords: ["thời trang tối giản", "minimalism", "phối đồ đẹp", "tủ đồ capsule", "xu hướng thời trang"],
    metaDesc: "Khám phá phong cách thời trang Minimalism. Hướng dẫn xây dựng tủ đồ tối giản, tinh tế và sang trọng cho người hiện đại."
  },
  {
    title: "Xu hướng Sneaker 2026: Sự trở lại của Retro và Chunky",
    slug: "xu-huong-sneaker-2026-retro-chunky",
    content: "<h3>Sự trỗi dậy của Retro Runner</h3><p>Các mẫu giày chạy bộ thập niên 70-80 đang quay trở lại mạnh mẽ. Adidas Samba, Onitsuka Tiger hay New Balance 530 đang xuất hiện khắp các con phố.</p><h3>Chunky Sneaker vẫn chưa hạ nhiệt</h3><p>Dù đã hot vài năm, những đôi giày đế thô, hầm hố vẫn được giới trẻ yêu thích vì khả năng 'hack' chiều cao và tạo điểm nhấn cho outfit.</p><h3>Gợi ý phối đồ</h3><ul><li>Phối với quần ống rộng (Wide leg) để tạo sự cân bằng.</li><li>Kết hợp với vớ cao cổ để tăng thêm phần cá tính.</li><li>Màu sắc: Ưu tiên các phối màu Vintage như kem, nâu, xanh rêu.</li></ul>",
    thumbnail: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&q=80&w=1000",
    catSlug: "thoi-trang",
    keywords: ["xu hướng sneaker", "giày thể thao 2026", "phối đồ sneaker", "retro style", "giày hot trend"],
    metaDesc: "Cập nhật xu hướng giày Sneaker hot nhất 2026. Từ phong cách Retro cổ điển đến những đôi Chunky cá tính, đâu là lựa chọn của bạn?"
  },
  {
    title: "Local Brand Việt Nam: Chất lượng có xứng đáng với giá tiền?",
    slug: "local-brand-viet-nam-chat-luong-gia-tien",
    content: "<h3>Bước chuyển mình của thời trang Việt</h3><p>Không còn mang mác 'giá rẻ vải xấu', nhiều Local Brand Việt hiện nay đã đầu tư mạnh vào R&D chất liệu và thiết kế, tạo ra những sản phẩm không thua kém brand quốc tế.</p><h3>Những cái tên nổi bật</h3><ul><li><b>Streetwear:</b> DirtyCoins, Bobui với thiết kế táo bạo.</li><li><b>Minimalism:</b> LIDER, The Mike Style với đường cắt may tinh tế.</li><li><b>Office wear:</b> Kujean, Dottie cho dân công sở.</li></ul><h3>Góc nhìn người tiêu dùng</h3><p>Ủng hộ hàng Việt là tốt, nhưng người tiêu dùng ngày càng thông thái hơn. Họ sẵn sàng chi trả cao nhưng đòi hỏi sự chỉn chu từ bao bì, dịch vụ đến chất lượng vải sau nhiều lần giặt.</p>",
    thumbnail: "https://images.unsplash.com/photo-1529139574466-a302c27e3844?auto=format&fit=crop&q=80&w=1000",
    catSlug: "thoi-trang",
    keywords: ["local brand việt nam", "thời trang việt", "review local brand", "streetwear việt nam", "mua sắm quần áo"],
    metaDesc: "Đánh giá chân thực về thị trường Local Brand Việt Nam hiện nay. Liệu chất lượng và thiết kế có tương xứng với mức giá ngày càng tăng?"
  },

  // 3. SẮC ĐẸP
  {
    title: "Routine Skincare 5 bước cho da dầu mụn vào mùa hè",
    slug: "routine-skincare-cho-da-dau-mun-mua-he",
    content: "<h3>1. Làm sạch kép (Double Cleansing)</h3><p>Đây là bước quan trọng nhất. Sử dụng nước tẩy trang micellar water, sau đó là sữa rửa mặt dịu nhẹ có độ pH 5.5 để loại bỏ bã nhờn mà không làm khô da.</p><h3>2. Toner cấp ẩm nhẹ</h3><p>Tránh các loại toner chứa cồn khô. Chọn toner chứa BHA nhẹ hoặc chiết xuất tràm trà để kiểm soát dầu.</p><h3>3. Serum đặc trị (Treatment)</h3><p>Niacinamide 10% là 'chân ái' cho da dầu lỗ chân lông to. Nếu có mụn viêm, hãy chấm Benzoyl Peroxide hoặc dùng serum chứa Salicylic Acid.</p><h3>4. Kem dưỡng dạng Gel</h3><p>Tuyệt đối không bỏ qua kem dưỡng. Hãy chọn dạng Gel hoặc Lotion mỏng nhẹ để khóa ẩm mà không gây bí tắc.</p><h3>5. Kem chống nắng phổ rộng</h3><p>Chọn loại 'Oil-free' và 'Non-comedogenic' để bảo vệ da khỏi tia UV mà không sinh thêm mụn.</p>",
    thumbnail: "https://images.unsplash.com/photo-1556228552-523d183d2047?auto=format&fit=crop&q=80&w=1000",
    catSlug: "sac-dep",
    keywords: ["skincare da dầu", "trị mụn", "chăm sóc da mùa hè", "quy trình dưỡng da", "review mỹ phẩm"],
    metaDesc: "Hướng dẫn chi tiết quy trình Skincare 5 bước chuẩn y khoa dành riêng cho làn da dầu mụn, giúp da sạch thoáng và mịn màng trong mùa hè."
  },
  {
    title: "Retinol là gì? Hướng dẫn sử dụng Retinol cho người mới bắt đầu",
    slug: "retinol-la-gi-huong-dan-nguoi-moi",
    content: "<h3>Thần dược chống lão hóa</h3><p>Retinol (dẫn xuất vitamin A) được xem là tiêu chuẩn vàng trong việc chống lão hóa, giảm nếp nhăn và hỗ trợ trị mụn nhờ khả năng thúc đẩy tái tạo tế bào.</p><h3>Nguyên tắc cho người mới</h3><ul><li><b>Nồng độ thấp:</b> Bắt đầu từ 0.3% hoặc 0.5%.</li><li><b>Tần suất thưa:</b> Tuần đầu dùng 1-2 lần, sau đó tăng dần khi da đã quen.</li><li><b>Kỹ thuật Sandwich:</b> Thoa một lớp kem dưỡng mỏng -> Retinol -> Lớp kem dưỡng nữa để giảm kích ứng.</li></ul><h3>Lưu ý sống còn</h3><p>Bắt buộc phải sử dụng kem chống nắng có SPF 50+ vào ban ngày vì Retinol làm da nhạy cảm hơn với ánh nắng mặt trời.</p>",
    thumbnail: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=1000",
    catSlug: "sac-dep",
    keywords: ["retinol là gì", "cách dùng retinol", "chống lão hóa", "skincare khoa học", "bí quyết làm đẹp"],
    metaDesc: "Tất tần tật về Retinol - hoạt chất vàng trong làng chống lão hóa. Cách sử dụng an toàn và hiệu quả cho người mới bắt đầu skincare."
  },
  {
    title: "Xu hướng trang điểm 'Clean Girl' makeup: Vẻ đẹp tự nhiên lên ngôi",
    slug: "xu-huong-trang-diem-clean-girl-makeup",
    content: "<h3>Định nghĩa 'Clean Girl'</h3><p>Đây là phong cách trang điểm tôn vinh nét đẹp tự nhiên, làn da căng bóng, lông mày chải dựng và đôi môi màu nude hoặc bóng nhẹ. Mục tiêu là trang điểm như không trang điểm.</p><h3>Các bước thực hiện</h3><ul><li><b>Lớp nền mỏng nhẹ:</b> Dùng Skin tint hoặc Cushion thay vì Foundation dày cộp. Che khuyết điểm chỉ ở những chỗ cần thiết.</li><li><b>Lông mày Fluffy:</b> Dùng gel định hình lông mày chải ngược lên để tạo độ tự nhiên.</li><li><b>Má hồng kem:</b> Tạo hiệu ứng ửng hồng từ bên trong.</li><li><b>Son bóng:</b> Hoàn thiện với một lớp lip gloss hoặc son dưỡng có màu.</li></ul><h3>Tại sao nó lại Hot?</h3><p>Nó phù hợp với lối sống bận rộn hiện đại, nhanh gọn và giúp gương mặt trông trẻ trung, đầy sức sống hơn.</p>",
    thumbnail: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=1000",
    catSlug: "sac-dep",
    keywords: ["clean girl makeup", "trang điểm tự nhiên", "xu hướng makeup", "làm đẹp 2026", "bí quyết trang điểm"],
    metaDesc: "Bắt trend phong cách trang điểm 'Clean Girl' đang làm mưa làm gió. Bí quyết để có lớp nền căng bóng và vẻ đẹp tự nhiên cuốn hút."
  },

  // 4. ĐỜI SỐNG
  {
    title: "Lối sống tối giản (Danshari) của người Nhật: Buông bỏ để hạnh phúc",
    slug: "loi-song-toi-gian-danshari-nguoi-nhat",
    content: "<h3>Danshari là gì?</h3><p>Dan (Từ chối) - Sha (Vứt bỏ) - Ri (Tránh xa). Đây không chỉ là dọn dẹp nhà cửa, mà là dọn dẹp tâm trí, loại bỏ những áp lực vô hình để tìm thấy sự bình yên.</p><h3>Áp dụng vào cuộc sống</h3><ul><li><b>Vật chất:</b> Chỉ giữ lại những món đồ thực sự mang lại niềm vui (Spark joy).</li><li><b>Mối quan hệ:</b> Mạnh dạn rời bỏ những mối quan hệ độc hại (Toxic relationship).</li><li><b>Thông tin:</b> Cai nghiện mạng xã hội, chọn lọc thông tin nạp vào mỗi ngày.</li></ul><h3>Kết quả</h3><p>Bạn sẽ có nhiều thời gian hơn cho bản thân, tiết kiệm tiền bạc và quan trọng nhất là cảm thấy nhẹ nhõm, tự do trong tâm hồn.</p>",
    thumbnail: "https://images.unsplash.com/photo-1445633814773-e687a5de9baa?auto=format&fit=crop&q=80&w=1000",
    catSlug: "doi-song",
    keywords: ["lối sống tối giản", "danshari", "sống hạnh phúc", "phát triển bản thân", "quản lý cuộc sống"],
    metaDesc: "Tìm hiểu triết lý Danshari của người Nhật. Học cách buông bỏ những điều dư thừa về vật chất và tinh thần để sống hạnh phúc và trọn vẹn hơn."
  },
  {
    title: "Kỹ thuật Pomodoro: Bí quyết tập trung siêu đẳng cho người hay trì hoãn",
    slug: "ky-thuat-pomodoro-tap-trung-sieu-dang",
    content: "<h3>Nguyên lý quả cà chua</h3><p>Pomodoro là phương pháp chia thời gian làm việc thành các phiên 25 phút, xen kẽ với 5 phút nghỉ ngắn. Sau 4 phiên thì nghỉ dài 15-30 phút.</p><h3>Tại sao nó hiệu quả?</h3><ul><li><b>Chống xao nhãng:</b> 25 phút là khoảng thời gian đủ ngắn để não bộ không bị mệt, nhưng đủ dài để hoàn thành một tác vụ nhỏ.</li><li><b>Tạo áp lực tích cực:</b> Tiếng đồng hồ đếm ngược thôi thúc bạn hoàn thành công việc.</li><li><b>Bảo vệ sức khỏe:</b> Thời gian nghỉ giúp mắt và cột sống được thư giãn.</li></ul><h3>Công cụ hỗ trợ</h3><p>Bạn có thể dùng app Forest, Tomato Timer hoặc đơn giản là đồng hồ bấm giờ trên điện thoại để bắt đầu ngay hôm nay.</p>",
    thumbnail: "https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&q=80&w=1000",
    catSlug: "doi-song",
    keywords: ["phương pháp pomodoro", "quản lý thời gian", "tăng sự tập trung", "làm việc hiệu quả", "kỹ năng mềm"],
    metaDesc: "Khắc phục tính trì hoãn và tăng năng suất làm việc gấp đôi với kỹ thuật Pomodoro. Phương pháp quản lý thời gian đơn giản mà hiệu quả bất ngờ."
  },
  {
    title: "Chữa lành (Healing): Trào lưu hay nhu cầu thiết yếu của Gen Z?",
    slug: "chua-lanh-healing-trao-luu-hay-thiet-yeu",
    content: "<h3>Thực trạng sức khỏe tinh thần</h3><p>Áp lực đồng trang lứa (Peer pressure), khủng hoảng hiện sinh và sự bùng nổ của mạng xã hội khiến Gen Z trở thành thế hệ dễ bị tổn thương tâm lý nhất.</p><h3>Các hình thức Healing phổ biến</h3><ul><li><b>Thiền định & Yoga:</b> Kết nối lại với cơ thể và hơi thở.</li><li><b>Sound Bath:</b> Trị liệu bằng chuông xoay hoặc âm thanh tự nhiên.</li><li><b>Viết Journal:</b> Giải tỏa cảm xúc qua trang giấy.</li><li><b>Du lịch chữa lành:</b> Về với thiên nhiên, bỏ lại khói bụi thành phố.</li></ul><h3>Lời khuyên</h3><p>Đừng biến 'chữa lành' thành một áp lực khác. Hãy lắng nghe bản thân thực sự cần gì, đôi khi chỉ là một giấc ngủ ngon hay một bữa ăn ngon là đủ.</p>",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=1000",
    catSlug: "doi-song",
    keywords: ["chữa lành", "healing", "sức khỏe tinh thần", "gen z", "thiền định"],
    metaDesc: "Giải mã trào lưu 'chữa lành' của giới trẻ. Liệu đây chỉ là trend nhất thời hay là tiếng chuông cảnh báo về sức khỏe tinh thần trong xã hội hiện đại?"
  },

  // 5. ẨM THỰC
  {
    title: "Eat Clean đúng cách: Thực đơn 7 ngày giảm cân mà không bị đói",
    slug: "eat-clean-dung-cach-thuc-don-giam-can",
    content: "<h3>Nguyên tắc Eat Clean</h3><p>Không phải là nhịn ăn, Eat Clean là ưu tiên thực phẩm nguyên bản (whole foods), hạn chế chế biến sẵn, đường tinh luyện và dầu mỡ xấu.</p><h3>Gợi ý thực đơn mẫu</h3><ul><li><b>Sáng:</b> Yến mạch ngâm sữa chua qua đêm (Overnight Oats) với hạt chia và chuối.</li><li><b>Trưa:</b> Cơm gạo lứt, ức gà áp chảo và súp lơ luộc.</li><li><b>Chiều:</b> Một nắm hạt hạnh nhân hoặc một quả táo.</li><li><b>Tối:</b> Salad cá ngừ hoặc canh tôm nấu bầu.</li></ul><h3>Lưu ý quan trọng</h3><p>Hãy lắng nghe cơ thể. Uống đủ 2-3 lít nước mỗi ngày và kết hợp tập luyện nhẹ nhàng để đạt hiệu quả tốt nhất.</p>",
    thumbnail: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=1000",
    catSlug: "am-thuc",
    keywords: ["eat clean", "thực đơn giảm cân", "chế độ ăn lành mạnh", "healthy food", "nấu ăn ngon"],
    metaDesc: "Gợi ý thực đơn Eat Clean 7 ngày khoa học, giúp bạn giảm cân hiệu quả, giữ dáng mà vẫn đảm bảo năng lượng làm việc, không lo bị đói."
  },
  {
    title: "Top 5 quán Phở gia truyền ngon nức tiếng tại Hà Nội",
    slug: "top-5-quan-pho-gia-truyen-ha-noi",
    content: "<h3>1. Phở Lý Quốc Sư</h3><p>Thương hiệu 'quốc dân' với nước dùng đậm đà, thịt bò tươi ngon. Dù có nhiều chi nhánh nhưng cơ sở gốc vẫn mang hương vị đặc biệt nhất.</p><h3>2. Phở Thìn Lò Đúc</h3><p>Nổi tiếng với món phở tái lăn nhiều hành. Nước dùng béo ngậy, thịt bò được xào nhanh trên lửa lớn tạo nên mùi thơm nức mũi.</p><h3>3. Phở Bát Đàn</h3><p>Nét văn hóa 'xếp hàng' trứ danh. Phở ở đây thanh, ngọt vị xương hầm kỹ, bánh phở mềm dai đúng điệu Hà Thành xưa.</p><h3>4. Phở Sướng - Đinh Liệt</h3><p>Cái tên nói lên tất cả. Ăn xong bát phở cảm thấy 'sướng' vì vị ngon tròn trịa, hài hòa.</p><h3>5. Phở Mặn Gầm Cầu</h3><p>Dành cho team thích ăn mặn mà, đậm đà. Bát phở đầy ắp thịt, ăn kèm quẩy giòn tan là hết ý.</p>",
    thumbnail: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=1000",
    catSlug: "am-thuc",
    keywords: ["phở hà nội", "quán ngon hà nội", "ẩm thực việt nam", "review đồ ăn", "du lịch hà nội"],
    metaDesc: "Khám phá bản đồ ẩm thực với 5 quán phở gia truyền ngon nhất Hà Nội. Trải nghiệm hương vị tinh túy của món ăn quốc hồn quốc túy Việt Nam."
  },
  {
    title: "Văn hóa cà phê Việt Nam: Từ vỉa hè đến những quán Specialty",
    slug: "van-hoa-ca-phe-viet-nam-via-he-specialty",
    content: "<h3>Cà phê cóc - Nét đẹp đường phố</h3><p>Hình ảnh những chiếc ghế nhựa thấp, ly cà phê đen đá hoặc nâu đá đậm đặc bên vỉa hè là đặc sản không thể thiếu của Sài Gòn và Hà Nội. Đó là nơi mọi câu chuyện bắt đầu.</p><h3>Sự trỗi dậy của Specialty Coffee</h3><p>Giới trẻ ngày nay đang dần khắt khe hơn. Họ tìm đến Pour Over, Cold Brew, Espresso pha máy từ những hạt Arabica chất lượng cao (Cầu Đất, Sơn La...).</p><h3>Các chuỗi cà phê lớn</h3><p>Highlands, The Coffee House hay Trung Nguyên Legend đã nâng tầm cà phê Việt, kết hợp giữa truyền thống và không gian trải nghiệm hiện đại.</p>",
    thumbnail: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1000",
    catSlug: "am-thuc",
    keywords: ["cà phê việt nam", "cà phê sữa đá", "specialty coffee", "quán cafe đẹp", "văn hóa ẩm thực"],
    metaDesc: "Hành trình khám phá văn hóa cà phê đa dạng của Việt Nam. Từ ly nâu đá vỉa hè dân dã đến làn sóng cà phê chất lượng cao (Specialty) hiện đại."
  },

  // 6. DU LỊCH
  {
    title: "Review du lịch Hà Giang: Chinh phục Cao nguyên đá Đồng Văn",
    slug: "review-du-lich-ha-giang-cao-nguyen-da",
    content: "<h3>Mùa nào đẹp nhất?</h3><p>Tháng 10-11 là mùa hoa Tam Giác Mạch nở rộ. Tháng 2-3 là mùa hoa đào, hoa mận trắng trời. Mùa hè thì mát mẻ, thích hợp đi trốn nóng.</p><h3>Lịch trình 3 ngày 2 đêm (Hà Giang Loop)</h3><ul><li><b>Ngày 1:</b> TP. Hà Giang - Quản Bạ - Yên Minh. Check-in Cổng trời và Núi đôi Cô Tiên.</li><li><b>Ngày 2:</b> Yên Minh - Lũng Cú - Đồng Văn. Chinh phục Cột cờ Lũng Cú, cực Bắc tổ quốc.</li><li><b>Ngày 3:</b> Đồng Văn - Mã Pí Lèng - Sông Nho Quế - Mèo Vạc. Trải nghiệm đi thuyền trên sông Nho Quế xanh biếc.</li></ul><h3>Lưu ý tay lái</h3><p>Đường đèo Hà Giang rất đẹp nhưng nguy hiểm. Hãy đảm bảo tay lái vững hoặc thuê driver bản địa để an toàn.</p>",
    thumbnail: "https://images.unsplash.com/photo-1596547608240-5e8654db08d8?auto=format&fit=crop&q=80&w=1000",
    catSlug: "du-lich",
    keywords: ["du lịch hà giang", "phượt hà giang", "mã pí lèng", "sông nho quế", "kinh nghiệm du lịch"],
    metaDesc: "Kinh nghiệm phượt Hà Giang chi tiết từ A-Z. Lịch trình chinh phục đèo Mã Pí Lèng, sông Nho Quế và ngắm hoa Tam Giác Mạch tuyệt đẹp."
  },
  {
    title: "Du lịch một mình (Solo Travel): Trải nghiệm để trưởng thành",
    slug: "du-lich-mot-minh-solo-travel-trai-nghiem",
    content: "<h3>Tại sao nên thử một lần?</h3><p>Đi một mình buộc bạn phải tự ra quyết định, tự xử lý rủi ro. Đó là cơ hội tuyệt vời để bước ra khỏi vùng an toàn và hiểu rõ bản thân mình hơn.</p><h3>Những điểm đến an toàn cho Solo Traveler</h3><ul><li><b>Đà Nẵng - Hội An:</b> Người dân thân thiện, dịch vụ tốt, an ninh đảm bảo.</li><li><b>Chiang Mai (Thái Lan):</b> Thiên đường cho dân du mục kỹ thuật số (Digital Nomad).</li><li><b>Nhật Bản:</b> Hệ thống giao thông công cộng tuyệt vời, văn hóa tôn trọng sự riêng tư.</li></ul><h3>Bí kíp an toàn</h3><p>Luôn gửi định vị cho người thân, không đi quá khuya ở nơi vắng vẻ và chia nhỏ tiền mặt ở nhiều nơi khác nhau.</p>",
    thumbnail: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=1000",
    catSlug: "du-lich",
    keywords: ["du lịch một mình", "solo travel", "kinh nghiệm đi phượt", "điểm đến an toàn", "tự túc du lịch"],
    metaDesc: "Cẩm nang du lịch một mình (Solo Travel) an toàn và thú vị. Gợi ý những điểm đến lý tưởng và bài học trưởng thành từ những chuyến đi độc hành."
  },
  {
    title: "Khám phá Phú Quốc: Không chỉ có biển xanh và cát trắng",
    slug: "kham-pha-phu-quoc-hon-dao-ngoc",
    content: "<h3>Thiên đường nghỉ dưỡng</h3><p>Phú Quốc sở hữu những Resort đẳng cấp quốc tế tại Bãi Kem, Bãi Dài. Đây là nơi ngắm hoàng hôn đẹp nhất Việt Nam (Sunset Sanato).</p><h3>Trải nghiệm văn hóa & ẩm thực</h3><ul><li><b>Làng chài Rạch Vẹm:</b> Ngắm sao biển và thưởng thức hải sản tươi sống.</li><li><b>Nhà thùng nước mắm:</b> Tìm hiểu quy trình làm ra loại nước mắm trứ danh.</li><li><b>Bún quậy Kiến Xây:</b> Món ăn độc đáo phải tự pha nước chấm.</li></ul><h3>Thành phố không ngủ</h3><p>Grand World và VinWonders mang đến trải nghiệm giải trí 24/7 với các show diễn thực cảnh hoành tráng và khu vui chơi tầm cỡ.</p>",
    thumbnail: "https://images.unsplash.com/photo-1590452329381-1250262e3d8f?auto=format&fit=crop&q=80&w=1000",
    catSlug: "du-lich",
    keywords: ["du lịch phú quốc", "đảo ngọc", "review phú quốc", "resort đẹp", "ẩm thực biển"],
    metaDesc: "Review du lịch Phú Quốc 2026. Tận hưởng kỳ nghỉ tại Đảo Ngọc với biển xanh, hải sản tươi ngon và các khu vui chơi giải trí đẳng cấp."
  },

  // 7. SÁCH
  {
    title: "Review sách 'Nhà Giả Kim': Hành trình đi tìm kho báu của chính mình",
    slug: "review-sach-nha-gia-kim-paulo-coelho",
    content: "<h3>Cuốn sách bán chạy mọi thời đại</h3><p>Nhà Giả Kim (The Alchemist) của Paulo Coelho là cuốn sách gối đầu giường của hàng triệu người. Câu chuyện về chàng chăn cừu Santiago đơn giản nhưng chứa đựng triết lý sâu sắc.</p><h3>Bài học đắt giá</h3><ul><li><b>Đại mệnh (Personal Legend):</b> Khi bạn khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được nó.</li><li><b>Hạnh phúc ở hiện tại:</b> Kho báu đôi khi không nằm ở đích đến, mà nằm ngay nơi ta bắt đầu, nhưng ta phải đi một vòng mới nhận ra.</li><li><b>Sợ hãi rào cản lớn nhất:</b> Chỉ có một điều khiến giấc mơ không thể trở thành hiện thực: đó là nỗi sợ thất bại.</li></ul><h3>Ai nên đọc?</h3><p>Bất cứ ai đang lạc lối, mất niềm tin hoặc đang ngần ngại theo đuổi ước mơ của mình.</p>",
    thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=1000",
    catSlug: "sach",
    keywords: ["review sách", "nhà giả kim", "sách hay nên đọc", "phát triển bản thân", "paulo coelho"],
    metaDesc: "Đọc review sách Nhà Giả Kim - Cuốn tiểu thuyết kinh điển về hành trình theo đuổi ước mơ. Bài học sâu sắc về định mệnh và lòng dũng cảm."
  },

  // 8. KHÁC
  {
    title: "Quản lý tài chính cá nhân 50/30/20: Quy tắc vàng cho người trẻ",
    slug: "quan-ly-tai-chinh-ca-nhan-50-30-20",
    content: "<h3>Quy tắc 50/30/20 là gì?</h3><p>Đây là phương pháp phân chia thu nhập sau thuế thành 3 nhóm để cân bằng giữa chi tiêu và tiết kiệm.</p><h3>Phân bổ chi tiết</h3><ul><li><b>50% Nhu cầu thiết yếu (Needs):</b> Tiền nhà, ăn uống, đi lại, điện nước. Đây là những thứ bạn không thể sống thiếu.</li><li><b>30% Mong muốn (Wants):</b> Mua sắm, du lịch, giải trí, cafe bạn bè. Đây là phần thưởng cho bản thân.</li><li><b>20% Tiết kiệm & Đầu tư (Savings):</b> Quỹ dự phòng khẩn cấp, đầu tư chứng khoán, trả nợ.</li></ul><h3>Tại sao nên áp dụng sớm?</h3><p>Lãi suất kép là kỳ quan thứ 8. Việc tích lũy 20% thu nhập ngay từ khi mới đi làm sẽ tạo ra khối tài sản khổng lồ sau 10-20 năm.</p>",
    thumbnail: "https://images.unsplash.com/photo-1579621970563-ebec7560eb3e?auto=format&fit=crop&q=80&w=1000",
    catSlug: "khac",
    keywords: ["quản lý tài chính", "tiết kiệm tiền", "đầu tư tài chính", "quy tắc 50/30/20", "tự do tài chính"],
    metaDesc: "Học cách quản lý tiền bạc thông minh với quy tắc 50/30/20. Bí quyết giúp người trẻ cân bằng chi tiêu, gia tăng tiết kiệm và đạt tự do tài chính."
  },
  {
    title: "Nghệ thuật giao tiếp: Đắc Nhân Tâm trong thời đại số",
    slug: "nghe-thuat-giao-tiep-dac-nhan-tam-thoi-dai-so",
    content: "<h3>Giao tiếp không chỉ là lời nói</h3><p>Trong thời đại của tin nhắn và email, kỹ năng giao tiếp càng trở nên quan trọng. 'Đắc Nhân Tâm' không phải là xu nịnh, mà là thấu hiểu và tôn trọng người khác.</p><h3>3 Nguyên tắc vàng</h3><ul><li><b>Không chỉ trích, oán trách:</b> Thay vào đó hãy cố gắng thấu hiểu hoàn cảnh của đối phương.</li><li><b>Khen ngợi chân thành:</b> Ai cũng khao khát được công nhận. Một lời khen đúng lúc có thể thay đổi một ngày của ai đó.</li><li><b>Lắng nghe chủ động:</b> Đừng nghe để trả lời, hãy nghe để hiểu. Đặt điện thoại xuống khi nói chuyện trực tiếp.</li></ul><h3>Ứng dụng trong công việc</h3><p>Kỹ năng mềm quyết định 80% sự thăng tiến. Người biết giao tiếp sẽ dễ dàng xây dựng network và giải quyết xung đột.</p>",
    thumbnail: "https://images.unsplash.com/photo-1521791136064-79858cfd7cdc?auto=format&fit=crop&q=80&w=1000",
    catSlug: "khac",
    keywords: ["kỹ năng giao tiếp", "đắc nhân tâm", "kỹ năng mềm", "phát triển sự nghiệp", "xây dựng mối quan hệ"],
    metaDesc: "Nâng cao kỹ năng giao tiếp với các bài học từ Đắc Nhân Tâm áp dụng cho thời đại số. Bí quyết thu phục lòng người và thành công trong sự nghiệp."
  },
  {
    title: "Review iPhone 15 Pro Max sau 6 tháng: Có còn là vua giữ giá?",
    slug: "review-iphone-15-pro-max-sau-6-thang",
    content: "<p>Đánh giá chi tiết hiệu năng, camera và pin của iPhone 15 Pro Max sau nửa năm sử dụng...</p>",
    thumbnail: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800",
    catSlug: "cong-nghe", // Link với danh mục Công Nghệ
    keywords: ["review iphone 15", "đánh giá iphone", "công nghệ", "apple"],
    metaDesc: "Đánh giá thực tế iPhone 15 Pro Max. Ưu nhược điểm, so sánh camera và thời lượng pin."
  },
  {
    title: "Top 5 Laptop Gaming dưới 20 triệu đáng mua nhất 2024",
    slug: "top-5-laptop-gaming-duoi-20-trieu-2024",
    content: "<p>Danh sách 5 mẫu laptop gaming cấu hình khủng, tản nhiệt tốt, giá sinh viên...</p>",
    thumbnail: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&q=80&w=800",
    catSlug: "cong-nghe",
    keywords: ["laptop gaming", "laptop giá rẻ", "sinh viên", "công nghệ"],
    metaDesc: "Tổng hợp 5 mẫu laptop chơi game giá rẻ dưới 20 triệu. Cấu hình mạnh."
  },
  // --- NHÓM THỜI TRANG (FASHION) ---
  {
    title: "Phối đồ phong cách Y2K: Xu hướng chưa bao giờ hạ nhiệt",
    slug: "phoi-do-phong-cach-y2k",
    content: "<p>Y2K là gì? Hướng dẫn mix match đồ theo phong cách những năm 2000 cực chất...</p>",
    thumbnail: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    catSlug: "thoi-trang",
    keywords: ["phối đồ đẹp", "thời trang y2k", "xu hướng thời trang", "outfit"],
    metaDesc: "Bí quyết phối đồ chuẩn phong cách Y2K. Gợi ý các item thời trang không thể thiếu."
  },
  {
    title: "Minimalism: Phong cách thời trang tối giản cho quý cô thanh lịch",
    slug: "phong-cach-thoi-trang-toi-gian-minimalism",
    content: "<p>Sống tối giản, mặc tối giản. Tại sao phong cách Minimalism lại được ưa chuộng...</p>",
    thumbnail: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&q=80&w=800",
    catSlug: "thoi-trang",
    keywords: ["minimalism", "thời trang tối giản", "thanh lịch"],
    metaDesc: "Khám phá phong cách thời trang Minimalism. Gợi ý phối đồ tối giản, sang trọng."
  },
  // --- NHÓM SẮC ĐẸP (BEAUTY) ---
  {
    title: "Quy trình Skincare 7 bước chuẩn Hàn Quốc cho da căng bóng",
    slug: "quy-trinh-skincare-7-buoc-chuan-han",
    content: "<p>Bí quyết có làn da glass skin. Tẩy trang, rửa mặt, toner, serum...</p>",
    thumbnail: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800",
    catSlug: "sac-dep",
    keywords: ["skincare", "chăm sóc da", "mỹ phẩm hàn quốc"],
    metaDesc: "Hướng dẫn quy trình chăm sóc da 7 bước chuẩn Hàn. Bí quyết giúp da căng bóng."
  },
  {
    title: "Cách chọn màu son hợp tone da: Da ngăm nên đánh màu gì?",
    slug: "cach-chon-mau-son-hop-tone-da",
    content: "<p>Bảng màu son cho da trắng, da trung bình và da ngăm...</p>",
    thumbnail: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=800",
    catSlug: "sac-dep",
    keywords: ["son môi", "makeup", "làm đẹp"],
    metaDesc: "Hướng dẫn chọn màu son môi tôn da. Gợi ý màu son đẹp cho da ngăm."
  },
  // --- NHÓM KHÁC ---
  {
    title: "Gợi ý 10 món quà Valentine ý nghĩa khiến 'nửa kia' tan chảy",
    slug: "goi-y-qua-tang-valentine-y-nghia",
    content: "<p>Valentine tặng gì? Chocolate, hoa, trang sức hay đồ handmade...</p>",
    thumbnail: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=800",
    catSlug: "doi-song",
    keywords: ["quà valentine", "quà tặng người yêu", "tình yêu"],
    metaDesc: "Top 10 món quà Valentine lãng mạn và ý nghĩa nhất."
  },
  {
    title: "Cách làm bánh Tiramisu không cần lò nướng cực dễ",
    slug: "cach-lam-banh-tiramisu-khong-can-lo-nuong",
    content: "<p>Công thức làm bánh Tiramisu chuẩn vị Ý ngay tại nhà...</p>",
    thumbnail: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&q=80&w=800",
    catSlug: "am-thuc",
    keywords: ["làm bánh", "tiramisu", "công thức nấu ăn"],
    metaDesc: "Hướng dẫn cách làm bánh Tiramisu ngon tuyệt không cần lò nướng."
  }
];

async function seedBlogs() {
  console.log('📝 Bắt đầu quá trình seed Blog & Danh mục Blog...');

  // 1. Tìm Author (Người đăng bài)
  const author = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SELLER', 'BUYER'] } },
    orderBy: { createdAt: 'asc' }
  });

  if (!author) {
    console.error('⚠️ LỖI: Không tìm thấy User nào để làm tác giả! Vui lòng tạo User trước.');
    return;
  }
  console.log(`👤 Sử dụng Tác giả: ${author.name || author.email}`);

  // 2. Seed Blog Categories (QUAN TRỌNG: Tạo danh mục trước)
  console.log('📂 Đang seed Blog Categories...');
  const categoryMap = new Map<string, string>(); // Map<slug, id>
  
  for (const cat of BLOG_CATEGORY_SEEDS) {
    // Lưu ý: Model có thể là `blogCategory` hoặc `categoryBlog` tuỳ schema của bạn.
    // Dựa vào context NestJS thường là `blogCategory`.
    const createdCat = await (prisma as any).blogCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug },
    });
    categoryMap.set(cat.slug, createdCat.id);
  }
  console.log(`   ✅ Đã seed ${categoryMap.size} danh mục blog.`);

  // 3. Chuẩn bị Related Products (Lấy sản phẩm để link)
  const products = await prisma.product.findMany({ select: { id: true }, take: 50 });
  const productIds = products.map(p => p.id);

  // 4. Seed Blog Posts
  console.log('✍️ Đang seed Blog Posts...');
  let successCount = 0;
  let skipCount = 0;

  for (const blog of BLOG_SEEDS) {
    // Lấy ID danh mục từ Map
    let categoryId = categoryMap.get(blog.catSlug);
    
    // Nếu không tìm thấy category đúng, lấy cái đầu tiên làm fallback
    if (!categoryId && categoryMap.size > 0) {
       categoryId = categoryMap.values().next().value;
    }

    // Random 3 sản phẩm liên quan
    const randomRelatedIds: { id: string }[] = [];
    if (productIds.length > 0) {
        const shuffled = [...productIds].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        selected.forEach(id => randomRelatedIds.push({ id }));
    }

    const exists = await prisma.blogPost.findUnique({ where: { slug: blog.slug } });
    
    if (!exists) {
        await prisma.blogPost.create({
            data: {
                title: blog.title,
                slug: blog.slug,
                content: blog.content,
                thumbnail: blog.thumbnail,
                status: 'PUBLISHED',
                authorId: author.id,
                // [FIX] Bây giờ categoryId là ID của bảng BlogCategory
                categoryId: categoryId, 
                metaTitle: blog.title,
                metaDescription: blog.metaDesc,
                keywords: JSON.stringify(blog.keywords),
                relatedProducts: {
                    connect: randomRelatedIds
                }
            }
        });
        successCount++;
    } else {
        skipCount++;
    }
  }

  console.log(`\n🎉 HOÀN TẤT SEED BLOG!`);
  console.log(`   ✅ Đã tạo mới: ${successCount} bài`);
  console.log(`   ⏭️ Đã bỏ qua: ${skipCount} bài`);
}

// Chạy hàm main
seedBlogs()
  .catch((e) => {
    console.error('❌ Có lỗi xảy ra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });