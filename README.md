<p align="center">
  <img src="assets/banner.svg" alt="Sticky Notes for Web" width="100%" />
</p>

<p align="center">
  웹 서핑 중 페이지 위에 포스트잇처럼 메모를 붙이고, 다시 방문해도 그대로 남아있는 크롬 익스텐션
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" />
  <img alt="No build step" src="https://img.shields.io/badge/build-none%20needed-brightgreen?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-Personal%20Project-lightgrey?style=flat-square" />
</p>

---

## ✨ 주요 기능

| | |
|---|---|
| 📌 **페이지에 고정** | 메모는 URL(해시 제외) 기준으로 저장되어, 같은 페이지로 돌아오면 자동으로 다시 나타납니다 |
| ✋ **자유로운 편집** | 드래그로 위치 이동, 모서리로 크기 조절, 클릭 한 번으로 텍스트 편집 |
| 🎨 **5가지 색상** | 헤더의 색상 점을 눌러 노트별로 색을 바꿀 수 있어요 |
| 🖱️ **우클릭으로 빠르게 추가** | 페이지 아무 곳이나 우클릭 → "여기에 스티키 노트 추가" |
| 🔌 **켜고 끄기** | 툴바 팝업의 토글 하나로 모든 탭의 메모를 즉시 표시/숨김 |
| 💾 **로컬 저장** | `chrome.storage.local`에만 저장되며, 외부 서버로 전송되지 않아요 |

## 🖼️ 미리보기

<p align="center">
  <img src="assets/screenshot-notes.svg" alt="페이지 위에 붙은 스티키 노트들" width="80%" />
  <br/>
  <sub>페이지 위에 자유롭게 배치된 스티키 노트</sub>
</p>

<p align="center">
  <img src="assets/screenshot-popup.svg" alt="확장 프로그램 팝업" width="45%" />
  <br/>
  <sub>툴바 팝업: 켜기/끄기, 메모 추가·전체 삭제</sub>
</p>

## 🚀 설치 방법 (개발자 모드)

1. 크롬 주소창에 `chrome://extensions` 입력 후 이동
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 저장소 폴더(`sticky-note/`) 선택

## 📖 사용 방법

- **메모 추가**: 툴바 아이콘 클릭 → `+ 이 페이지에 메모 추가`, 또는 페이지 우클릭 → `여기에 스티키 노트 추가`
- **이동**: 노트 상단 헤더를 드래그
- **크기 조절**: 노트 우측 하단 모서리를 드래그
- **색상 변경**: 헤더의 색상 점 클릭
- **삭제**: 헤더 우측 `×` 클릭, 또는 팝업의 `이 페이지 메모 모두 삭제`
- **전체 켜기/끄기**: 팝업 상단 토글 스위치

## 🗂️ 프로젝트 구조

```
sticky-note/
├── manifest.json      # Manifest V3 설정
├── background.js      # 우클릭 컨텍스트 메뉴 처리
├── content.js          # 노트 렌더링 · 드래그 · 리사이즈 · 저장 로직
├── content.css         # 노트 스타일
├── popup.html/js/css   # 툴바 팝업 UI
├── icons/               # 확장 프로그램 아이콘
└── assets/              # README용 이미지
```

## 💾 데이터 저장 구조

```jsonc
// chrome.storage.local
{
  "enabled": true,
  "notes": {
    "https://example.com/path": [
      { "id": "n123", "text": "메모 내용", "x": 120, "y": 340, "w": 220, "h": 160, "color": "#fff6a9", "z": 2147483001 }
    ]
  }
}
```

페이지 키는 `origin + pathname + search`로 만들어지며, 해시(`#...`)는 포함되지 않습니다.

---

<p align="center"><sub>Made for personal note-taking while browsing. 🗒️</sub></p>
