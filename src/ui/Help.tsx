import { KEY_BINDINGS } from "../core/keymap";

const MOUSE_HELP: [string, string][] = [
  ["ホイール", "進む / 戻る"],
  ["左クリック", "進む"],
  ["右クリック", "戻る"],
];

interface Props {
  onClose: () => void;
  settingsPath: string | null;
  libraryPath: string | null;
}

export function Help({ onClose, settingsPath, libraryPath }: Props) {
  return (
    <div
      class="help"
      onClick={(e) => {
        e.stopPropagation(); // 親の「クリックで進む」を発火させない
        onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div class="help-panel" onClick={(e) => e.stopPropagation()}>
        <div class="help-head">
          <h2>pageboy の操作</h2>
          <button class="close" onClick={onClose} title="閉じる (Esc)">
            ×
          </button>
        </div>
        <p class="lead">すべて 1 キーで操作できます。Ctrl や Shift との組み合わせはありません。</p>
        <table>
          <tbody>
            {KEY_BINDINGS.map((b) => (
              <tr key={b.action}>
                <td class="keys">
                  {b.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </td>
                <td>{b.label}</td>
              </tr>
            ))}
            {MOUSE_HELP.map(([k, label]) => (
              <tr key={k}>
                <td class="keys">
                  <kbd>{k}</kbd>
                </td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="note">速度・拡大率・表示モードは次回も引き継ぎます。作品ごとの「順番 / ランダム」と最後に読んだページも覚えます。</p>
        {(settingsPath || libraryPath) && (
          <p class="note paths">
            {libraryPath && (
              <>
                既定のライブラリ: <code>{libraryPath}</code>
                <br />
              </>
            )}
            {settingsPath && (
              <>
                設定ファイル: <code>{settingsPath}</code>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
