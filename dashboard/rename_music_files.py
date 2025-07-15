import os
import json
import re
from pathlib import Path

def sanitize_filename(filename):
    # Loại bỏ các ký tự không hợp lệ trong tên file
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def main():
    # Đường dẫn đến thư mục chứa script
    base_dir = Path(__file__).parent
    
    # Đường dẫn đến file playlists.json và thư mục music
    playlists_path = base_dir / "asset" / "playlists.json"
    music_dir = base_dir / "music"
    
    # Đọc dữ liệu từ playlists.json
    with open(playlists_path, 'r', encoding='utf-8') as f:
        playlists = json.load(f)
    
    # Tạo dictionary lưu thông tin đổi tên
    rename_map = {}
    
    # Duyệt qua tất cả các playlist
    for playlist in playlists.values():
        for song in playlist:
            # Lấy tên file gốc (vd: "music/1.mp3" -> "1.mp3")
            original_name = os.path.basename(song['path'])
            
            # Tạo tên mới từ tiêu đề bài hát
            new_name = f"{song['title']}.mp3"
            new_name = sanitize_filename(new_name)
            
            # Thêm vào dictionary nếu chưa có hoặc nếu tên mới dài hơn (chi tiết hơn)
            if original_name not in rename_map or len(new_name) > len(rename_map[original_name]):
                rename_map[original_name] = new_name
    
    # Thực hiện đổi tên file
    for original_name, new_name in rename_map.items():
        old_path = music_dir / original_name
        new_path = music_dir / new_name
        
        # Kiểm tra xem file gốc có tồn tại không
        if not old_path.exists():
            print(f"Cảnh báo: Không tìm thấy file {old_path}")
            continue
        
        # Kiểm tra xem file đích đã tồn tại chưa
        if new_path.exists():
            print(f"Cảnh báo: {new_path} đã tồn tại, bỏ qua đổi tên {old_path}")
            continue
        
        try:
            # Đổi tên file
            old_path.rename(new_path)
            print(f"Đã đổi tên: {original_name} -> {new_name}")
        except Exception as e:
            print(f"Lỗi khi đổi tên {original_name}: {str(e)}")

if __name__ == "__main__":
    main()
