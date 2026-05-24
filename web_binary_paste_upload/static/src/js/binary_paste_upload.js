odoo.define("web_binary_paste_upload.binary_paste_upload", function (require) {
    "use strict";

    var BasicFields = require("web.basic_fields");
    var RelationalFields = require("web.relational_fields");
    var core = require("web.core");
    var fieldRegistry = require("web.field_registry");
    var session = require("web.session");
    var utils = require("web.utils");

    var _t = core._t;
    var FieldMany2ManyBinaryMultiFiles = RelationalFields.FieldMany2ManyBinaryMultiFiles;
    var activePasteWidget = null;

    $(document).on("paste.web_binary_paste_upload", function (ev) {
        if (activePasteWidget && !activePasteWidget.isDestroyed()) {
            activePasteWidget._onPasteUpload(ev);
        }
    });

    $(document).on("keydown.web_binary_paste_upload", function (ev) {
        var isUndo = (ev.ctrlKey || ev.metaKey) && !ev.shiftKey && String(ev.key || "").toLowerCase() === "z";
        if (!isUndo || !activePasteWidget || activePasteWidget.isDestroyed()) {
            return;
        }
        if ($(ev.target).closest("input, textarea, [contenteditable='true']").length) {
            return;
        }
        if (activePasteWidget._undoLastPasteUpload && activePasteWidget._undoLastPasteUpload()) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    });

    function getClipboardFiles(ev) {
        var clipboard = ev.originalEvent && ev.originalEvent.clipboardData;
        if (!clipboard) {
            return [];
        }

        var files = [];
        if (clipboard.files && clipboard.files.length) {
            files = Array.prototype.slice.call(clipboard.files);
        }

        if (!files.length && clipboard.items && clipboard.items.length) {
            Array.prototype.forEach.call(clipboard.items, function (item) {
                if (item.kind === "file") {
                    var file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            });
        }
        return files;
    }

    function getDroppedFiles(ev) {
        var dataTransfer = ev.originalEvent && ev.originalEvent.dataTransfer;
        if (!dataTransfer || !dataTransfer.files || !dataTransfer.files.length) {
            return [];
        }
        return Array.prototype.slice.call(dataTransfer.files);
    }

    function getPasteFileName(file, index) {
        if (file.name) {
            return file.name;
        }
        var now = new Date();
        var timestamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            "_",
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0"),
            String(now.getSeconds()).padStart(2, "0"),
        ].join("");
        var extension = "bin";
        if (file.type && file.type.indexOf("/") !== -1) {
            extension = file.type.split("/")[1].split(";")[0] || extension;
        }
        if (extension === "jpeg") {
            extension = "jpg";
        }
        return "clipboard_" + timestamp + "_" + (index + 1) + "." + extension;
    }

    function getMaxUploadSize(widget) {
        return widget.max_upload_size || session.max_file_upload_size || 128 * 1024 * 1024;
    }

    function getContentUrl(id, filename, download) {
        var safeName = encodeURIComponent(filename || "file");
        var url = "/web/content/" + id + "/" + safeName;
        if (download) {
            url += "?download=true";
        }
        return url;
    }

    function isImageMimetype(mimetype) {
        return Boolean(mimetype && mimetype.indexOf("image/") === 0);
    }

    var PasteMixin = {
        _preparePasteTarget: function () {
            if (this.mode === "readonly") {
                this.$el.removeAttr("tabindex title");
                this.$el.removeClass("o_binary_paste_upload o_binary_paste_upload_active o_binary_paste_upload_dragover");
                this.$(".o_binary_paste_upload_hint").remove();
                return;
            }
            this.$el.attr("tabindex", "0");
            this.$el.addClass("o_binary_paste_upload");
            this.$el.attr("title", _t("Bấm vào đây rồi Ctrl+V hoặc kéo thả để upload ảnh/file. Ctrl+Z để thu hồi file vừa thêm."));
            if (!this.$(".o_binary_paste_upload_hint").length) {
                this.$el.append(
                    $("<div/>", {
                        class: "o_binary_paste_upload_hint",
                    }).append(
                        $("<span/>", {class: "fa fa-cloud-upload o_binary_paste_upload_hint_icon"}),
                        $("<span/>", {class: "o_binary_paste_upload_hint_text", text: _t("Ctrl+V hoặc kéo thả ảnh/file vào đây. Ctrl+Z để thu hồi file vừa thêm")})
                    )
                );
            }
        },

        _activatePasteTarget: function () {
            if (this.mode !== "readonly") {
                activePasteWidget = this;
                this.$el.addClass("o_binary_paste_upload_active");
            }
        },

        _deactivatePasteTarget: function () {
            if (activePasteWidget === this) {
                activePasteWidget = null;
            }
            this.$el.removeClass("o_binary_paste_upload_active");
        },

        _focusPasteTarget: function () {
            var ev = arguments[0];
            if (ev && $(ev.target).closest("a, button, .o_attachment_delete, .o_attach, input").length) {
                return;
            }
            if (this.mode !== "readonly") {
                this._activatePasteTarget();
                var self = this;
                _.defer(function () {
                    if (!self.isDestroyed()) {
                        self.$el.focus();
                    }
                });
            }
        },

        _onPasteUpload: function (ev) {
            if (this.mode === "readonly") {
                return;
            }
            var files = getClipboardFiles(ev);
            if (!files.length) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            this._uploadPastedFiles(files);
        },

        _onDragOverUpload: function (ev) {
            if (this.mode === "readonly") {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            this._activatePasteTarget();
            this.$el.addClass("o_binary_paste_upload_dragover");
        },

        _onDragLeaveUpload: function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            this.$el.removeClass("o_binary_paste_upload_dragover");
        },

        _onDropUpload: function (ev) {
            if (this.mode === "readonly") {
                return;
            }
            var files = getDroppedFiles(ev);
            if (!files.length) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            this.$el.removeClass("o_binary_paste_upload_dragover");
            this._uploadPastedFiles(files);
        },

        destroy: function () {
            this._deactivatePasteTarget();
            return this._super.apply(this, arguments);
        },

        _render: function () {
            var result = this._super.apply(this, arguments);
            this._preparePasteTarget();
            return result;
        },
    };

    var FieldBinaryPasteUpload = BasicFields.FieldBinaryFile.extend(PasteMixin, {
        events: _.extend({}, BasicFields.FieldBinaryFile.prototype.events, {
            paste: "_onPasteUpload",
            mousedown: "_focusPasteTarget",
            mouseenter: "_activatePasteTarget",
            mouseleave: "_deactivatePasteTarget",
            focusin: "_activatePasteTarget",
            focusout: "_deactivatePasteTarget",
            dragenter: "_onDragOverUpload",
            dragover: "_onDragOverUpload",
            dragleave: "_onDragLeaveUpload",
            drop: "_onDropUpload",
        }),

        _uploadPastedFiles: function (files) {
            var self = this;
            var file = files[0];
            var maxUploadSize = getMaxUploadSize(this);
            if (file.size > maxUploadSize) {
                this.displayNotification({
                    title: _t("File upload"),
                    message: _.str.sprintf(
                        _t("The selected file exceed the maximum file size of %s."),
                        utils.human_size(maxUploadSize)
                    ),
                    type: "danger",
                });
                return;
            }
            var previousValue = this.value || false;
            utils.getDataURLFromFile(file).then(function (data) {
                self._undoPasteStack = self._undoPasteStack || [];
                self._undoPasteStack.push(previousValue);
                self.on_file_uploaded(
                    file.size,
                    getPasteFileName(file, 0),
                    file.type || "application/octet-stream",
                    data.split(",")[1]
                );
            }, function () {
                self.displayNotification({
                    title: _t("Clipboard upload"),
                    message: _t("Không đọc được file từ clipboard."),
                    type: "danger",
                });
            });
        },

        _undoLastPasteUpload: function () {
            if (!this._undoPasteStack || !this._undoPasteStack.length || this.mode === "readonly") {
                return false;
            }
            var previousValue = this._undoPasteStack.pop();
            this._setValue(previousValue || false);
            this.displayNotification({
                title: _t("Clipboard upload"),
                message: _t("Đã thu hồi file vừa thêm."),
                type: "info",
            });
            return true;
        },
    });

    var FieldMany2ManyBinaryPasteUpload = FieldMany2ManyBinaryMultiFiles.extend(PasteMixin, {
        events: _.extend({}, FieldMany2ManyBinaryMultiFiles.prototype.events, {
            "click .o_attachment a[href]": "_onPreviewAttachment",
            paste: "_onPasteUpload",
            mousedown: "_focusPasteTarget",
            mouseenter: "_activatePasteTarget",
            mouseleave: "_deactivatePasteTarget",
            focusin: "_activatePasteTarget",
            focusout: "_deactivatePasteTarget",
            dragenter: "_onDragOverUpload",
            dragover: "_onDragOverUpload",
            dragleave: "_onDragLeaveUpload",
            drop: "_onDropUpload",
        }),

        _getFileUrl: function (attachment) {
            return getContentUrl(attachment.id, attachment.name, !isImageMimetype(attachment.mimetype));
        },

        _render: function () {
            var result = this._super.apply(this, arguments);
            this._preparePasteTarget();
            this.$(".o_attachment a[href]").attr({
                target: false,
                rel: false,
            });
            this.$(".o_attachment").each(function () {
                var $attachment = $(this);
                var isImage = isImageMimetype($attachment.find(".o_image").data("mimetype"));
                $attachment.find("a[href]").attr({
                    title: isImage ? _t("Xem ảnh") : _t("Tải file"),
                });
            });
            return result;
        },

        _onPreviewAttachment: function (ev) {
            var href = $(ev.currentTarget).attr("href");
            var mimetype = $(ev.currentTarget).closest(".o_attachment").find(".o_image").data("mimetype");
            if (!href || href.indexOf("/web/content/") === -1 || !isImageMimetype(mimetype)) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            var width = 900;
            var height = 700;
            var left = Math.max(0, Math.round((window.screen.width - width) / 2));
            var top = Math.max(0, Math.round((window.screen.height - height) / 2));
            var previewWindow = window.open(
                href,
                "wingroup_attachment_preview",
                [
                    "popup=yes",
                    "width=" + width,
                    "height=" + height,
                    "left=" + left,
                    "top=" + top,
                    "resizable=yes",
                    "scrollbars=yes",
                    "toolbar=no",
                    "menubar=no",
                    "location=yes",
                    "status=no",
                ].join(",")
            );
            if (previewWindow) {
                previewWindow.focus();
            }
        },

        _uploadPastedFiles: function (files) {
            var self = this;
            var attachmentIds = this.value.res_ids.slice();
            var maxUploadSize = getMaxUploadSize(this);
            var creates = _.map(files, function (file, index) {
                if (file.size > maxUploadSize) {
                    self.displayNotification({
                        title: _t("File upload"),
                        message: _.str.sprintf(
                            _t("The selected file exceed the maximum file size of %s."),
                            utils.human_size(maxUploadSize)
                        ),
                        type: "danger",
                    });
                    return $.Deferred().resolve(false);
                }
                return utils.getDataURLFromFile(file).then(function (data) {
                    var vals = {
                        name: getPasteFileName(file, index),
                        datas: data.split(",")[1],
                        mimetype: file.type || "application/octet-stream",
                        type: "binary",
                    };
                    if (self.model) {
                        vals.res_model = self.model;
                    }
                    if (self.res_id) {
                        vals.res_id = self.res_id;
                    }
                    return self._rpc({
                        model: "ir.attachment",
                        method: "create",
                        args: [vals],
                    });
                }, function () {
                    self.displayNotification({
                        title: _t("Clipboard upload"),
                        message: _t("Không đọc được file từ clipboard."),
                        type: "danger",
                    });
                    return false;
                });
            });

            $.when.apply($, creates).then(function () {
                var createdIds = [];
                Array.prototype.forEach.call(arguments, function (attachmentId) {
                    if (attachmentId) {
                        createdIds.push(attachmentId);
                        attachmentIds.push(attachmentId);
                        self.uploadedFiles[attachmentId] = true;
                    }
                });
                if (!createdIds.length) {
                    return;
                }
                self._undoPasteStack = self._undoPasteStack || [];
                Array.prototype.forEach.call(createdIds, function (attachmentId) {
                    self._undoPasteStack.push([attachmentId]);
                });
                self._setValue({
                    operation: "REPLACE_WITH",
                    ids: attachmentIds,
                });
            });
        },

        _undoLastPasteUpload: function () {
            if (!this._undoPasteStack || !this._undoPasteStack.length || this.mode === "readonly") {
                return false;
            }
            var undoIds = this._undoPasteStack.pop();
            var keepIds = _.difference(this.value.res_ids || [], undoIds);
            this._setValue({
                operation: "REPLACE_WITH",
                ids: keepIds,
            });
            this._rpc({
                model: "ir.attachment",
                method: "unlink",
                args: [undoIds],
            });
            this.displayNotification({
                title: _t("Clipboard upload"),
                message: _t("Đã thu hồi file vừa thêm."),
                type: "info",
            });
            return true;
        },
    });

    fieldRegistry.add("binary_paste_upload", FieldBinaryPasteUpload);
    fieldRegistry.add("many2many_binary_paste_upload", FieldMany2ManyBinaryPasteUpload);

    return {
        FieldBinaryPasteUpload: FieldBinaryPasteUpload,
        FieldMany2ManyBinaryPasteUpload: FieldMany2ManyBinaryPasteUpload,
    };
});
