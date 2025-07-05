# Supabase Storage Setup for aVOIDgame.io

## Storage Buckets Structure

### 1. Create Storage Buckets

**Bucket: `game-assets`**
- **Purpose**: Store game logos, icons, and static images
- **Public**: Yes (for easy access)
- **Structure**:
  ```
  game-assets/
  ├── logos/
  │   ├── voidavoid.png
  │   ├── tankavoid.png
  │   └── wreckavoid.png
  ├── heroes/
  │   └── avoid-hero.png
  ├── icons/
  │   └── favicon.ico
  └── ui/
      └── buttons/
  ```

**Bucket: `game-audio`**
- **Purpose**: Store background music and sound effects
- **Public**: Yes
- **Structure**:
  ```
  game-audio/
  ├── music/
  │   ├── tankavoid/
  │   │   ├── background.mp3
  │   │   └── battle.mp3
  │   ├── wreckavoid/
  │   │   ├── background.mp3
  │   │   └── destruction.mp3
  │   └── voidavoid/
  │       └── ambient.mp3
  └── sfx/
      ├── explosion.wav
      ├── hit.wav
      └── powerup.wav
  ```

**Bucket: `game-videos`**
- **Purpose**: Store gameplay preview videos
- **Public**: Yes
- **Structure**:
  ```
  game-videos/
  ├── previews/
  │   ├── voidavoid-preview.mp4
  │   ├── tankavoid-preview.mp4
  │   └── wreckavoid-preview.mp4
  └── tutorials/
      └── how-to-play.mp4
  ```

## Setup Instructions

### 1. Create Buckets in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Storage > Buckets
3. Create the following buckets:
   - `game-assets` (Public)
   - `game-audio` (Public)
   - `game-videos` (Public)

### 2. Set Bucket Policies

For public access, use this policy for all buckets:

```sql
-- Allow public read access
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'game-assets');

CREATE POLICY "Public read access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'game-audio');

CREATE POLICY "Public read access" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'game-videos');
```

### 3. Upload Assets

**Current Assets to Upload:**
- `/public/VoidaVOID.png` → `game-assets/logos/voidavoid.png`
- `/public/Tank aVOID Logo Design.png` → `game-assets/logos/tankavoid.png`
- `/public/WreckAVOID.png` → `game-assets/logos/wreckavoid.png`
- `/public/AVOIDhero.png` → `game-assets/heroes/avoid-hero.png`

### 4. Get Storage URLs

Base URL format: `https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]`

Example URLs:
- VOIDaVOID Logo: `https://jyuafqzjrzifqbgcqbnt.supabase.co/storage/v1/object/public/game-assets/logos/voidavoid.png`
- Hero Image: `https://jyuafqzjrzifqbgcqbnt.supabase.co/storage/v1/object/public/game-assets/heroes/avoid-hero.png`

## Benefits

1. **Reduced Bundle Size**: Games load faster with external assets
2. **Centralized Management**: Update assets without redeploying
3. **CDN Distribution**: Supabase provides global CDN
4. **Scalability**: Easy to add more assets and media
5. **Version Control**: Track asset changes through Supabase

## Next Steps

1. Create buckets in Supabase dashboard
2. Upload current assets
3. Update code to use Supabase URLs
4. Test asset loading
5. Add music files for TankaVOID and WreckaVOID
6. Prepare for gameplay video uploads 