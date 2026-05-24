# Web Binary Paste Upload

Module cho Odoo 15.

## Mục đích

Cho phép người dùng bấm vào vùng upload rồi dùng `Ctrl+V` để dán ảnh/file trực tiếp từ clipboard, hoặc kéo thả file vào vùng upload.

Module cung cấp widget riêng, không patch toàn bộ widget mặc định.

Áp dụng cho:

- Trường `binary`.
- Trường Many2many tới `ir.attachment`.

## Cách dùng

Cài module:

```bash
python3 odoo/odoo-bin -c erp.conf -i web_binary_paste_upload
```

Nếu module đã cài rồi:

```bash
python3 odoo/odoo-bin -c erp.conf -u web_binary_paste_upload
```

Sau đó sửa XML field cần dùng widget.

Ví dụ các field sau sẽ tự dùng được:

```xml
<field name="file_data" filename="file_name" widget="binary_paste_upload"/>
<field name="image_1920" widget="binary_paste_upload"/>
<field name="attachment_ids" widget="many2many_binary_paste_upload"/>
```

Không dùng các widget trên thì field sẽ giữ hành vi Odoo mặc định.

## Thao tác người dùng

1. Copy ảnh/file từ máy tính/trình duyệt hoặc kéo file từ máy tính.
2. Di chuột vào hoặc bấm vào vùng field binary/attachment.
3. Nhấn `Ctrl+V` hoặc thả file vào vùng upload.
4. File được upload vào field hiện tại.

## Lưu ý

- Với field binary đơn, nếu paste nhiều file thì chỉ lấy file đầu tiên.
- Với many2many attachment, có thể paste nhiều file cùng lúc nếu browser cung cấp nhiều file trong clipboard.
- Với field binary đơn, kéo thả/paste nhiều file thì chỉ lấy file đầu tiên.
- Nếu file vượt quá giới hạn upload của Odoo, hệ thống sẽ báo lỗi.
- Ảnh copy từ clipboard thường không có tên file; module sẽ tự đặt tên `clipboard_YYYYMMDD_HHMMSS_1.png`.
