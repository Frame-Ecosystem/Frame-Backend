# FeedContentSystem

Powers the social content layer of the platform — posts, reels, comments, likes, saves, hashtags, reporting, and the personalized feed.

## Responsibilities

- Create and manage **posts** (text + images) and **reels** (short videos)
- Media upload to **Cloudflare R2** (images and video)
- **Hashtag** normalization, indexing, and trending
- Like / unlike posts and reels
- Nested **comments** with like support
- **Content saves** (bookmarks)
- **Feed generation** — personalized feed from followed users + own content
- **Content moderation** — hide/unhide/delete by admins
- **User reports** — flag and review inappropriate content

## Structure

```
FeedContentSystem/
├── controllers/    post · reel · comment · feed · like · contentModeration · report
├── services/       post · reel · comment · feed · like · report
├── models/         post · reel · comment · like · contentLike · contentSave · hashtag · report
├── routes/         post · reel · comment · feed · like · report
├── dtos/           post.dto.ts · reel.dto.ts · comment.dto.ts · report.dto.ts
└── interfaces/     content.interface.ts · like.interface.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `Post` | Text + images, authorId, authorType, hashtags[], likeCount, saveCount |
| `Reel` | Short video (1-60s), caption, videoUrl, thumbnailUrl, hashtags[] |
| `Comment` | Comment on post or reel, supports nested replies |
| `ContentLike` | Like on a post or reel |
| `ContentSave` | User bookmark on a post or reel |
| `Hashtag` | Indexed hashtag with usage count |
| `Report` | User report with status and admin review |

## Author Types

Posts and reels can be authored by: `user` | `lounge`

## API Routes

| Method | Path | Description |
|---|---|---|
| CRUD | `/v1/posts` | Post management |
| CRUD | `/v1/reels` | Reel management |
| CRUD | `/v1/comments` | Comment management |
| GET | `/v1/feed` | Personalized feed |
| POST/DELETE | `/v1/likes/:contentType/:id` | Like / unlike |
| POST | `/v1/reports` | Report content |
| PUT | `/v1/admin/content/:id` | Moderate content |

## Dependencies

- **Inbound**: `UserManager` (author identity, follow graph)
- **Outbound**: `NotificationSystem` (like/comment/mention events), `shared/cloudflareR2` (media storage)
