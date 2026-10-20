<p align="center">
  <img src="icons/vn-telex.svg" width="96" alt="Biểu tượng VN Telex">
</p>

<h1 align="center">VN Telex</h1>

<p align="center">
  🇬🇧 <a href="README.md">English</a> · 🇻🇳 <b>Tiếng Việt</b>
</p>

<p align="center">
  Biến chữ gõ kiểu Telex thành tiếng Việt có dấu, ngay tại chỗ bạn gõ.<br>
  Extension cho GNOME Shell, chạy trên Wayland và X11, hỗ trợ GNOME 46 đến 50.
</p>

<p align="center">
  <img src="screenshots/vn-telex.png" alt="VN Telex chuyển chữ Telex, bên cạnh cửa sổ Cài đặt">
</p>

---

Gõ xong cả câu mới phát hiện bộ gõ tiếng Việt đang tắt? Bôi đen đoạn đó, nhấn phím tắt của bạn (ví dụ **Super+Shift+A**), và
nó được sửa ngay tại chỗ:

```
Tieengs Vieetj khoong daaus, deploy leen server
                    ↓
Tiếng Việt không dấu, deploy lên server
```

Không cần bộ gõ, không cần sao chép qua lại. Dùng được trong trình duyệt, trình soạn thảo, ứng dụng chat
và mọi ứng dụng hỗ trợ Ctrl+C và Ctrl+V, kể cả terminal.

## Trường hợp sử dụng

- 🧑‍💻 **Lập trình viên quen dùng tiếng Anh.** Hệ điều hành, editor và bàn phím của bạn đều để tiếng Anh,
  và bạn không muốn bộ gõ tiếng Việt can thiệp vào từng phím. Cứ gõ Telex thoải mái, chỉ chuyển khi cần.
- 🙅 **Không cần bộ gõ.** Khỏi cài đặt và cấu hình IBus/Fcitx chỉ để thỉnh thoảng nhắn vài câu tiếng Việt.
  Một extension, một phím tắt.
- 😅 **"Ủa, quên bật bộ gõ."** Lỡ gõ cả đoạn thành `ddi awn cowm chuwa`? Bôi đen, nhấn phím tắt, xong.
  Không phải gõ lại.
- 🐛 **Bộ gõ xung đột với công cụ.** Autocomplete, editor code hay ứng dụng web bị lỗi với bộ gõ (lặp chữ,
  mất ký tự) không còn là vấn đề: bạn gõ ASCII thuần rồi chuyển sau.
- 💬 **Trộn tiếng Việt với thuật ngữ kỹ thuật.** Chat với team về `deploy`, `merge`, `staging` bằng tiếng
  Việt? Từ tiếng Anh được giữ nguyên, phần Telex xung quanh được thêm dấu.
- 🖥️ **Dân Terminal.** Gõ commit message hay prompt cho công cụ CLI bằng Telex, bôi đen rồi chuyển ngay
  trong GNOME Terminal, Ptyxis, Kitty, Alacritty, WezTerm hay Ghostty. Trong Neovim, gán phím cho `cli.js`.

## Tính năng

- **Chuyển ngay tại chỗ.** Thay thế đoạn văn bản đang chọn trong ứng dụng đang dùng.
- **Giữ nguyên clipboard.** Nội dung bạn đã sao chép, dù là chữ hay hình ảnh, đều được khôi phục sau đó.
- **Hiểu văn bản trộn lẫn.** Các từ tiếng Anh như `deploy`, `test` và `data` được giữ nguyên. Chỉ những âm
  tiết tiếng Việt hợp lệ mới được chuyển, và danh sách từ bỏ qua (có thể chỉnh sửa) xử lý phần còn lại.
- **Xử lý khi không chọn gì.** Có thể tự chọn ngược về đầu đoạn rồi chuyển, hỏi bạn trước, hoặc không làm gì.
- **Cài đặt chỉn chu.** Ô ghi phím tắt, phần xem trước "Thử ngay" và trình sửa danh sách từ bỏ qua có tìm kiếm.
- **Giao diện tiếng Anh và tiếng Việt.** Theo ngôn ngữ hệ thống, hoặc tự chọn trong phần Cài đặt.
- **Tương thích Copyous.** Nếu Copyous được cài, nó sẽ được chuyển sang chế độ ẩn danh trong lúc chuyển đổi,
  để văn bản trung gian không lọt vào lịch sử clipboard.
- **Bộ lọc dòng lệnh.** `cli.js` dùng cùng engine và chạy được trong Neovim, script và pipe.

## Bảng tra Telex

| Gõ | Ra | | Gõ | Ra |
|---|---|---|---|---|
| `aa` `ee` `oo` | â ê ô | | `s` | sắc (á) |
| `aw` `ow` `uw` | ă ơ ư | | `f` | huyền (à) |
| `uow` | ươ | | `r` | hỏi (ả) |
| `dd` | đ | | `x` | ngã (ã) |
| | | | `j` | nặng (ạ) |

Phím dấu có thể đặt ở bất kỳ đâu sau nguyên âm: `vieetj` và `vietej` đều cho ra **việt**.

## Cài đặt

```sh
git clone git@github.com:tecix/vn-telex.git ~/.local/share/gnome-shell/extensions/vn-telex@tecix
gnome-extensions enable vn-telex@tecix
```

Trên Wayland, đăng xuất rồi đăng nhập lại để GNOME Shell nạp extension mới. Trên X11, bạn có thể nhấn
Alt+F2, gõ `r` rồi nhấn Enter.

Mặc định chưa có phím tắt, vì extension hoạt động qua clipboard. Mở phần Cài đặt
(`gnome-extensions prefs vn-telex@tecix`) và nhấp vào **Phím tắt** để chọn, ví dụ **Super+Shift+A**.

Để cập nhật, chạy `git pull` trong thư mục đó rồi đăng xuất và đăng nhập lại.

## Cách dùng

1. Chọn đoạn văn bản gõ kiểu Telex.
2. Nhấn phím tắt của bạn.

Để đổi phím tắt và các thiết lập khác, mở phần Cài đặt:

```sh
gnome-extensions prefs vn-telex@tecix
```

| Thiết lập | Mặc định | Mô tả |
|---|---|---|
| Phím tắt | Chưa đặt | Nhấp vào dòng này rồi nhấn một tổ hợp phím, ví dụ `Super+Shift+A`. |
| Khi không bôi đen gì | Tự chọn tới đầu đoạn | Gửi Ctrl+Shift+↑ rồi chuyển phần được chọn. Bạn cũng có thể chọn *Hỏi trước* hoặc *Không làm gì*. |
| Thời gian chờ vùng chọn | 600 ms | Thời gian chờ Ctrl+C sao chép được gì đó trước khi coi như không có vùng chọn. Giảm xuống để *Khi không bôi đen gì* phản hồi nhanh hơn; tăng lên nếu một ứng dụng chậm bị coi nhầm là không có vùng chọn. |
| Chế độ nhanh (Nâng cao) | Tắt | Giúp *Khi không bôi đen gì* nhanh hơn nhiều. Phản hồi ngay khi app sao chép xong thay vì kiểm tra mỗi 30 ms, học tốc độ sao chép của từng app để chỉ chờ 2 × lần chậm nhất + 40 ms (ít nhất 80 ms, tối đa bằng *Thời gian chờ vùng chọn*), và gộp hai lần sao chép vào một phiên clipboard. Nếu một app chậm bị nhận nhầm là chưa bôi đen, hãy xoá thời gian đã học hoặc tắt chế độ này. |
| Trong terminal | Thay phần vừa gõ | Sao chép bằng Ctrl+Shift+C, xoá phần thay đổi bằng Backspace rồi dán kết quả bằng Ctrl+Shift+V. Bạn cũng có thể chọn *Chỉ sao chép kết quả* (để tự dán) hoặc *Không làm gì*. Xem [Terminal và Neovim](#terminal-và-neovim). |
| Hiện thông báo | Bật | Báo cho bạn khi không có gì để chuyển. |
| Ngôn ngữ | Tự động | Đặt ngôn ngữ giao diện: Tự động, English hoặc Tiếng Việt. |
| Từ bỏ qua | ~50 thuật ngữ kỹ thuật | Những từ không bao giờ được chuyển. Mỗi mục khớp theo tiền tố, nên `test` cũng áp dụng cho `tests` và `testing`. |

## Terminal và Neovim

Terminal sao chép và dán bằng Ctrl+Shift+C và Ctrl+Shift+V, và vùng chọn trong terminal chỉ là phần tô
sáng trên màn hình: không thể thay thế như trong ô nhập liệu. Vì vậy trong terminal, extension sẽ:

1. sao chép vùng chọn bằng **Ctrl+Shift+C**,
2. chuyển đổi và chỉ giữ phần bị thay đổi (`chaof` → `chào` chỉ đổi `of` → `ào`),
3. gửi một phím **Backspace** cho mỗi ký tự bị thay đổi, rồi dán phần mới bằng **Ctrl+Shift+V**.

Cách này dùng được cho text vừa gõ ở dấu nhắc shell, trong ô nhập của ứng dụng TUI hoặc ở chế độ insert của
Neovim. Từ bước 3 suy ra hai quy tắc:

- **Vùng chọn phải kết thúc ở con trỏ.** Bôi đen phần vừa gõ, hoặc nhấp ba lần vào dòng lệnh: dấu nhắc
  được giữ nguyên vì chỉ phần thay đổi bị xoá.
- **Không kèm dấu cách cuối.** Terminal bỏ dấu cách ở cuối vùng chọn, nên nếu con trỏ nằm sau dấu cách thì
  sẽ xoá thiếu một ký tự. Hãy chuyển trước khi gõ dấu cách.

Nếu phần thay đổi trải qua nhiều dòng, Backspace không xoá tới được, nên kết quả được đưa vào clipboard để
bạn tự dán. Điều này cũng áp dụng cho mọi lần chuyển khi *Trong terminal* được đặt là *Chỉ sao chép kết
quả*. xterm, urxvt và st không có Ctrl+Shift+C (phím này sẽ tới shell thành Ctrl+C), nên chúng bị bỏ qua.

Với chế độ normal và visual của Neovim, hoặc trong script và pipe, hãy dùng bộ lọc dòng lệnh:

```sh
echo "Xin chaof cacs banj" | ~/.local/share/gnome-shell/extensions/vn-telex@tecix/cli.js
# Xin chào các bạn
```

Để chuyển vùng chọn visual trong Neovim bằng `<leader>tv`:

```vim
xnoremap <leader>tv :!~/.local/share/gnome-shell/extensions/vn-telex@tecix/cli.js<CR>
```

`cli.js` đọc cùng danh sách từ bỏ qua với extension.

## Cách hoạt động

1. Phím tắt được nhấn. Extension chờ bạn nhả các phím bổ trợ, rồi lưu clipboard hiện tại.
2. Nó gửi một phím **Ctrl+C** ảo và chờ văn bản được sao chép (tối đa bằng *Thời gian chờ vùng chọn*).
3. Văn bản được chuyển từng từ một. Từ bỏ qua và những gì không phải âm tiết tiếng Việt hợp lệ được giữ nguyên.
4. Nó đặt kết quả lên clipboard, gửi **Ctrl+V**, rồi khôi phục clipboard ban đầu.

Nếu không sao chép được gì, nó dùng thiết lập *Khi không bôi đen gì*.

## Cấu trúc dự án

```
extension.js   Phím tắt, xử lý clipboard, bàn phím ảo, hộp thoại và thông báo
prefs.js       Cửa sổ Cài đặt (libadwaita)
telex.js       Engine Telex → tiếng Việt (không phụ thuộc GNOME)
i18n.js        Chuỗi gốc tiếng Anh và bản dịch tiếng Việt
cli.js         Bộ lọc dòng lệnh (gjs)
schemas/       GSettings schema
icons/         Biểu tượng extension
screenshots/   Hình ảnh cho README và extensions.gnome.org
```

Sau khi sửa schema, biên dịch lại:

```sh
glib-compile-schemas schemas/
```

Để theo dõi log của extension khi thử nghiệm:

```sh
journalctl -f -o cat /usr/bin/gnome-shell | grep -i telex
```

## Tương thích

- GNOME Shell 46, 47, 48, 49 và 50
- Wayland và X11
- Ứng dụng phải hỗ trợ Ctrl+C và Ctrl+V. Terminal được nhận diện và dùng Ctrl+Shift+C và Ctrl+Shift+V.

## TODO

- [x] 🖥️ **Terminal:** chuyển ngay tại chỗ trong các terminal (GNOME Terminal, Ptyxis, Kitty, Alacritty,
  WezTerm) bằng Ctrl+Shift+C / Ctrl+Shift+V thay vì bỏ qua.
- [ ] 🦊 **Extension cho Firefox:** chuyển vùng chọn trong mọi ô nhập liệu, trên mọi hệ điều hành.
- [ ] 🌐 **Extension cho Chrome:** tương tự cho Chrome, Edge, Brave và các trình duyệt Chromium khác.

## Ghi công

Engine Telex được port từ [VN Textify](https://www.raycast.com/locnguyen1842/vn-textify) của Loc Nguyen
(Giấy phép MIT).
