// UI strings are written in English; VI holds the Vietnamese translations.
// The 'language' setting picks one: auto (follow the system locale), en or vi.
// Placeholders like {word} are filled from the params object.

import GLib from 'gi://GLib';

const VI = {
    // extension.js
    'Not supported in terminals — in Neovim, map a key to cli.js.': 'Terminal không hỗ trợ — trong Neovim, map phím tới cli.js.',
    'Nothing is selected.': 'Chưa bôi đen text nào.',
    'Couldn’t select any text before the cursor.': 'Không chọn được text trước con trỏ.',
    'Nothing selected': 'Không có vùng chọn',
    'Select this paragraph (Ctrl+Shift+↑) and convert it to Vietnamese?': 'Chọn đoạn văn này (Ctrl+Shift+↑) rồi chuyển sang tiếng Việt?',
    'Cancel': 'Huỷ',
    'Select & convert': 'Chọn & chuyển',

    // prefs.js
    'General': 'Chung',
    'How to use': 'Cách dùng',
    'Select text typed in Telex, then press the shortcut — the selection is replaced with accented Vietnamese.':
        'Bôi đen text gõ Telex rồi bấm phím tắt — vùng chọn được thay bằng tiếng Việt có dấu.',
    'Shortcut': 'Phím tắt',
    'Click to set a new shortcut': 'Bấm để đặt phím tắt mới',
    'Disabled': 'Chưa đặt',
    'Reset to default': 'Khôi phục mặc định',
    'Remove shortcut': 'Xoá phím tắt',
    'When nothing is selected': 'Khi không bôi đen gì',
    'Select to paragraph start': 'Tự chọn tới đầu đoạn',
    'Press Ctrl+Shift+↑, then convert': 'Ctrl+Shift+↑ rồi chuyển luôn',
    'Ask first': 'Hỏi trước',
    'Show a confirmation dialog': 'Hiện hộp thoại xác nhận',
    'Do nothing': 'Không làm gì',
    'Just report that nothing is selected': 'Chỉ báo chưa có vùng chọn',
    'Selection wait time (ms)': 'Thời gian chờ vùng chọn (ms)',
    'How long to wait for copied text before treating the selection as empty. Lower is faster; raise it if some apps get treated as having no selection.':
        'Thời gian chờ text được sao chép trước khi coi như chưa bôi đen. Càng thấp càng nhanh; tăng lên nếu có app bị nhận nhầm là chưa bôi đen.',
    'Advanced': 'Nâng cao',
    'Fast mode': 'Chế độ nhanh',
    'Speeds up “When nothing is selected”: reacts the moment an app copies, learns how fast each app copies and waits only that long, and skips the pauses between steps. If a slow app is wrongly treated as having no selection, forget its timing or turn this off.':
        'Tăng tốc “Khi không bôi đen gì”: phản hồi ngay khi app sao chép xong, học tốc độ sao chép của từng app để chỉ chờ vừa đủ, và bỏ các khoảng nghỉ giữa các bước. Nếu một app chậm bị nhận nhầm là chưa bôi đen, hãy xoá thời gian đã học hoặc tắt chế độ này.',
    'Learned app timings': 'Thời gian đã học theo app',
    'Forget all learned timings': 'Xoá mọi thời gian đã học',
    '{ms} ms': '{ms} ms',
    '{count} apps · the wait is 2 × the slowest copy + 40 ms': '{count} app · thời gian chờ = 2 × lần sao chép chậm nhất + 40 ms',
    'None yet — learned while fast mode is on': 'Chưa có — được học khi bật chế độ nhanh',
    'Show notifications': 'Hiện thông báo',
    'Tell me when a conversion can’t run (terminal, no text…)': 'Báo khi không chuyển được (terminal, không có text…)',
    'Language': 'Ngôn ngữ',
    'Reopen preferences to update this window': 'Mở lại cửa sổ cài đặt để cập nhật',
    'Automatic': 'Tự động',
    'Follow the system language': 'Theo ngôn ngữ hệ thống',
    'Press a new shortcut': 'Nhấn tổ hợp phím mới',
    'Esc to cancel · Backspace to clear the shortcut': 'Esc để huỷ · Backspace để xoá phím tắt',
    'Use at least one of Ctrl, Alt or Super': 'Cần ít nhất một phím Ctrl, Alt hoặc Super',
    'Set shortcut': 'Đặt phím tắt',
    'Try it': 'Thử ngay',
    'Type Telex below to see the result (skip words applied).': 'Gõ Telex vào ô dưới để xem kết quả (đã áp dụng danh sách từ bỏ qua).',
    'Telex text': 'Văn bản Telex',
    'Result': 'Kết quả',
    'Copy': 'Sao chép',
    'Skip words': 'Từ bỏ qua',
    'English words left untouched, matched by prefix (e.g. “test” also keeps “tests”, “testing”).':
        'Từ tiếng Anh giữ nguyên, khớp theo tiền tố (vd. “test” giữ cả “tests”, “testing”).',
    'Restore the default list': 'Khôi phục danh sách mặc định',
    'Add words (comma-separated)': 'Thêm từ (có thể nhập nhiều, cách nhau bằng dấu phẩy)',
    'Search the list': 'Tìm trong danh sách',
    'Word list': 'Danh sách',
    'No words': 'Không có từ nào',
    'Removed “{word}”': 'Đã xoá “{word}”',
    '{shown} / {total} words': '{shown} / {total} từ',
    '{total} words': '{total} từ',
    'Added “{word}”': 'Đã thêm “{word}”',
    'Added {count} words': 'Đã thêm {count} từ',
    'Default list restored': 'Đã khôi phục danh sách mặc định',
    'Remove “{word}”': 'Xoá “{word}”',
    'Notes': 'Lưu ý',
    'Terminal': 'Terminal',
    'Not supported in terminals. For Neovim, map a key to cli.js in the extension folder.':
        'Không hỗ trợ trong terminal. Với Neovim, map phím tới cli.js trong thư mục extension.',
    'Clipboard': 'Clipboard',
    'Your clipboard is restored after converting; Copyous is switched to incognito meanwhile.':
        'Clipboard được khôi phục sau khi chuyển; Copyous được bật ẩn danh trong lúc chuyển.',
};

function systemIsVietnamese() {
    return GLib.get_language_names().some(l => l === 'vi' || l.startsWith('vi_'));
}

// Returns _(text, params) bound to the settings' current language
export function translator(settings) {
    return (text, params = {}) => {
        let lang = settings.get_string('language');
        if (lang === 'auto')
            lang = systemIsVietnamese() ? 'vi' : 'en';
        const s = lang === 'vi' ? VI[text] ?? text : text;
        return s.replace(/\{(\w+)\}/g, (m, k) => k in params ? String(params[k]) : m);
    };
}
