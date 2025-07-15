import json
import os
from pathlib import Path

def main():
    # Đường dẫn đến thư mục chứa script
    base_dir = Path(__file__).parent
    
    # Đường dẫn đến file playlists.json và thư mục music
    playlists_path = base_dir / "asset" / "playlists.json"
    music_dir = base_dir / "music"
    
    # Đọc dữ liệu từ playlists.json
    with open(playlists_path, 'r', encoding='utf-8') as f:
        playlists = json.load(f)
    
    # Tạo dictionary ánh xạ tên file cũ sang tên file mới
    file_mapping = {}
    for file_path in music_dir.glob("*.mp3"):
        file_mapping[file_path.name] = file_path.name
    
    # Cập nhật đường dẫn trong playlists
    updated = False
    for playlist_name, songs in playlists.items():
        if not isinstance(songs, list):
            continue
            
        for song in songs:
            if not isinstance(song, dict) or 'path' not in song:
                continue
                
            # Lấy tên file cũ (vd: "music/1.mp3" -> "1.mp3")
            old_path = song['path']
            old_filename = os.path.basename(old_path)
            
            # Nếu tên file đã được đổi
            if old_filename in file_mapping and old_filename != file_mapping[old_filename]:
                # Cập nhật đường dẫn mới
                new_path = f"music/{file_mapping[old_filename]}"
                print(f"Đã cập nhật: {old_path} -> {new_path}")
                song['path'] = new_path
                updated = True
    
    # Ghi lại file nếu có thay đổi
    if updated:
        with open(playlists_path, 'w', encoding='utf-8') as f:
            json.dump(playlists, f, ensure_ascii=False, indent=4)
        print("\nĐã cập nhật xong file playlists.json")
    else:
        print("Không có thay đổi nào được thực hiện.")

if __name__ == "__main__":
    main()
