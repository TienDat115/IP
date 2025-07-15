import json
import os
from pathlib import Path

def get_new_filename(old_filename):
    """Hàm này ánh xạ tên file cũ sang tên file mới dựa trên title"""
    # Tạo một dictionary ánh xạ tên file cũ sang mới
    mapping = {
        "1.mp3": "Tháp Rơi Tự Do - LBI Lợi Bỉ.mp3",
        "2.mp3": "Ghép Hình Tình Yêu - Tưởng Tư DiNhạc Nhiên.mp3",
        "3.mp3": "Góp Vui - Sơ Nguyệt.mp3",
        # Thêm các ánh xạ khác tương tự
    }
    
    # Nếu tên file cũ có trong mapping thì trả về tên mới, không thì giữ nguyên
    return mapping.get(old_filename, old_filename)

def main():
    # Đường dẫn đến thư mục chứa script
    base_dir = Path(__file__).parent
    
    # Đường dẫn đến file playlists.json và thư mục music
    playlists_path = base_dir / "asset" / "playlists.json"
    
    # Đọc dữ liệu từ playlists.json
    with open(playlists_path, 'r', encoding='utf-8') as f:
        playlists = json.load(f)
    
    # Cập nhật đường dẫn trong playlists
    updated = False
    for playlist_name, songs in playlists.items():
        if not isinstance(songs, list):
            continue
            
        for song in songs:
            if not isinstance(song, dict) or 'path' not in song or 'title' not in song:
                continue
                
            # Lấy tên file cũ (vd: "music/1.mp3" -> "1.mp3")
            old_path = song['path']
            old_filename = os.path.basename(old_path)
            
            # Tạo tên file mới từ title
            new_filename = f"{song['title']}.mp3"
            # Xóa các ký tự không hợp lệ trong tên file
            new_filename = "".join(c for c in new_filename if c not in '\/*?:"<>|')
            
            # Nếu tên file thay đổi
            if old_filename != new_filename:
                # Cập nhật đường dẫn mới
                new_path = f"music/{new_filename}"
                print(f"Đã cập nhật: {old_path} -> {new_path}")
                song['path'] = new_path
                updated = True
    
    # Ghi lại file nếu có thay đổi
    if updated:
        # Tạo bản sao lưu
        backup_path = playlists_path.with_suffix('.json.bak')
        import shutil
        shutil.copy2(playlists_path, backup_path)
        print(f"\nĐã sao lưu file gốc thành: {backup_path}")
        
        # Ghi file mới
        with open(playlists_path, 'w', encoding='utf-8') as f:
            json.dump(playlists, f, ensure_ascii=False, indent=4, separators=(',', ': '))
        print("Đã cập nhật xong file playlists.json")
    else:
        print("Không có thay đổi nào được thực hiện.")

if __name__ == "__main__":
    main()
