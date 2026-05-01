# ToushiHistory

Apache Cordova 製の Android アプリ。外部 API から取得した JSON データをもとに、投資信託の購入履歴をリスト・グラフ・月別集計で表示します。

---

## アプリ情報

| 項目 | 値 |
|---|---|
| アプリ名 | 投資信託購入履歴 |
| パッケージ ID | com.example.toushiHistory |
| バージョン | 1.0.0 |
| ライセンス | Apache-2.0 |

---

## 対応プラットフォーム

- **Android** (cordova-android ^14.0.1)
- **Browser** (cordova-browser ^7.0.0)

---

## 主な機能

| 画面 / ダイアログ | 説明 |
|---|---|
| **ファンド一覧 (index)** | ファンド名・口座種別・積立方法・コース・購入開始年月を一覧表示 |
| **取引履歴ダイアログ** | ファンドをタップすると注文日・注文金額・数量・基準価格・受渡日・支払金額を表示 |
| **グラフダイアログ** | 数量・基準価格・注文金額の月次推移を SVG 折れ線グラフとミニチャートで表示 |
| **月別支払いダイアログ** | 月ごとの支払い合計と支払い方法別（クレジットカード・証券口座・楽天キャッシュ）内訳を表示 |
| **月別支払い詳細ダイアログ** | 選択した月の注文を日付順に詳細表示 |

---

## 使用ライブラリ・プラグイン

| 名前 | バージョン | 用途 |
|---|---|---|
| cordova-plugin-advanced-http | ^3.3.1 | Android での HTTP 通信・CORS 回避 |
| cordova-plugin-file | ^8.1.3 | ファイルアクセス |

---

## 外部 API

| エンドポイント | 説明 |
|---|---|
| `http://toyohide.work/BrainLog/api/getToushiShintakuDealHistory` | 投資信託の取引履歴データ（ファンド名・口座種別・注文日・数量・基準価格・支払金額など） |

---

## Android 設定 (config.xml)

| 設定項目 | 値 |
|---|---|
| usesCleartextTraffic | true |

---

## プロジェクト構成

```
cordova_json_sample_6/
├── config.xml          # Cordova 設定ファイル
├── package.json        # npm / Cordova 依存関係
└── www/
    ├── index.html      # メイン画面
    ├── css/            # スタイルシート
    ├── img/            # 画像リソース
    └── js/
        └── index.js    # メインロジック（API 呼び出し・UI 描画）
```

---

## セットアップ・ビルド

```bash
# 依存関係インストール
npm install

# Android ビルド
npx cordova build android

# ブラウザで実行
npx cordova run browser
```
