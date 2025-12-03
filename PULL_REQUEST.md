# Add Windows Support with Enhanced Features

## 🎯 Overview / 개요

This PR adds comprehensive Windows support to Claude Usage Tool, along with internationalization (i18n) and user-configurable settings.

이 PR은 Claude Usage Tool에 포괄적인 Windows 지원을 추가하고, 국제화(i18n) 및 사용자 설정 기능을 제공합니다.

## ✨ New Features / 새로운 기능

### 1. Windows Platform Support / Windows 플랫폼 지원
- ✅ NSIS installer configuration for Windows
- ✅ Windows-specific tray icon positioning (above taskbar)
- ✅ Proper window behavior for Windows system tray
- ✅ Windows 10/11 compatibility

**Windows용 NSIS 인스톨러 설정, 작업 표시줄 위 트레이 아이콘 위치 조정, Windows 10/11 호환성**

### 2. Multi-language Support (i18n) / 다국어 지원
- ✅ English and Korean language support
- ✅ Easy-to-extend translation system
- ✅ Language switcher in settings
- ✅ Persistent language preference

**영어와 한국어 지원, 확장 가능한 번역 시스템, 설정에서 언어 전환, 언어 설정 저장**

### 3. User Settings Panel / 사용자 설정 패널
- ✅ Settings UI with gear icon in header
- ✅ Configurable refresh interval (10-600 seconds)
- ✅ Auto-start on system boot toggle
- ✅ Language selection
- ✅ Settings persistence using electron-store

**헤더의 설정 아이콘, 새로고침 간격 설정(10-600초), 부팅 시 자동 시작 토글, 언어 선택, electron-store를 사용한 설정 저장**

### 4. Performance Improvements / 성능 개선
- ✅ Data caching in localStorage for instant loading
- ✅ Background data refresh while showing cached data
- ✅ Improved scraper with better percentage detection
- ✅ Enhanced platform login detection

**즉시 로딩을 위한 localStorage 데이터 캐싱, 캐시된 데이터를 보여주면서 백그라운드 새로고침, 개선된 퍼센트 감지, 향상된 Platform 로그인 감지**

## 🔧 Technical Changes / 기술적 변경사항

### Modified Files / 수정된 파일
- `package.json` - Added Windows build configuration and electron-store dependency
- `electron/main.ts` - Added settings management, auto-start, and Windows-specific positioning
- `electron/preload.ts` - Added settings IPC handlers
- `electron/scraper.ts` - Enhanced usage parsing with better fallback logic
- `src/App.tsx` - Integrated i18n and settings, added data caching
- `src/components/ClaudeMaxUsage.tsx` - Added i18n support
- `src/components/ApiCosts.tsx` - Added i18n support
- `src/index.css` - Added settings panel styles
- `README.md` - Updated for Windows support

### New Files / 새로운 파일
- `src/i18n/translations.ts` - Translation strings for English and Korean
- `src/i18n/LanguageContext.tsx` - React context for language management
- `src/components/Settings.tsx` - Settings panel component

## 📦 Dependencies / 의존성
- Already included: `electron-store` (was in devDependencies)
- No new runtime dependencies added

**이미 포함됨: electron-store (devDependencies에 있었음), 새로운 런타임 의존성 추가 없음**

## 🧪 Testing / 테스트

Tested on:
- ✅ Windows 11
- ✅ Development mode (`npm run electron:dev`)
- ✅ All features verified working

**Windows 11에서 테스트 완료, 개발 모드에서 테스트 완료, 모든 기능 작동 확인**

## 📸 Screenshots / 스크린샷

### Settings Panel / 설정 패널
- Language selection (English/Korean)
- Refresh interval configuration
- Auto-start toggle

### Korean UI / 한국어 UI
- All UI elements translated
- Proper text layout for Korean

## 🚀 Build Instructions / 빌드 방법

```bash
# Install dependencies / 의존성 설치
npm install

# Development mode / 개발 모드
npm run electron:dev

# Build for Windows / Windows용 빌드
npm run electron:build

# Build for macOS / macOS용 빌드
npm run electron:build:mac
```

## 💡 Usage / 사용법

1. Click the settings icon (⚙️) in the header / 헤더의 설정 아이콘(⚙️) 클릭
2. Select your preferred language / 원하는 언어 선택
3. Configure refresh interval / 새로고침 간격 설정
4. Enable/disable auto-start / 자동 시작 활성화/비활성화
5. Click Save / 저장 클릭

## 🔄 Backward Compatibility / 하위 호환성

- ✅ Fully backward compatible with macOS
- ✅ No breaking changes to existing functionality
- ✅ Default settings match original behavior

**macOS와 완전히 호환, 기존 기능에 대한 변경 없음, 기본 설정은 원래 동작과 동일**

## 📝 Notes / 참고사항

- The app now supports both Windows and macOS
- Settings are stored locally and persist across restarts
- Language preference is saved in localStorage
- Auto-start uses Electron's built-in `setLoginItemSettings`

**앱이 이제 Windows와 macOS를 모두 지원, 설정은 로컬에 저장되며 재시작 후에도 유지, 언어 설정은 localStorage에 저장, 자동 시작은 Electron의 내장 setLoginItemSettings 사용**

## 🙏 Acknowledgments / 감사의 말

Thank you for creating this useful tool! I hope these enhancements make it even more accessible to Windows users and international audiences.

유용한 도구를 만들어주셔서 감사합니다! 이러한 개선 사항이 Windows 사용자와 국제 사용자들에게 더욱 접근하기 쉽게 만들기를 바랍니다.

---

## Checklist / 체크리스트

- [x] Code follows the project's style guidelines
- [x] Self-review of code completed
- [x] No new warnings or errors introduced
- [x] Tested on Windows 11
- [x] Documentation updated (README.md)
- [x] Backward compatible with existing functionality

**코드가 프로젝트 스타일 가이드를 따름, 코드 자체 검토 완료, 새로운 경고나 오류 없음, Windows 11에서 테스트 완료, 문서 업데이트 완료, 기존 기능과 하위 호환**
