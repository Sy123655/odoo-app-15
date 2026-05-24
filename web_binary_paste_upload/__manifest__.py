# -*- coding: utf-8 -*-
{
    "name": "Web Binary Paste Upload",
    "summary": "Cho phép Ctrl+V hoặc kéo thả để upload file/ảnh vào trường binary và many2many attachment",
    "version": "15.0.1.0.0",
    "category": "Web",
    "website": "https://wgroup.vn",
    "author": "WGROUP, Cap Van Sy",
    "license": "AGPL-3",
    "depends": [
        "web",
    ],
    "assets": {
        "web.assets_backend": [
            "web_binary_paste_upload/static/src/js/binary_paste_upload.js",
            "web_binary_paste_upload/static/src/scss/binary_paste_upload.scss",
        ],
    },
    "installable": True,
    "application": False,
}
