package com.geuncha.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.text.InputType;
import androidx.appcompat.app.AlertDialog;
import java.net.URI;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle state) {
        String server = getPreferences(MODE_PRIVATE).getString("testServer", "");
        if (!server.isEmpty())
            config = new CapConfig.Builder(this).setServerUrl(server).setStartPath("/mobile-test").create();
        super.onCreate(state);
        FrameLayout root = findViewById(android.R.id.content);
        View web = root.getChildAt(0);
        root.removeView(web);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        Button settings = new Button(this);
        settings.setText("PC 연결 주소 설정");
        settings.setOnClickListener(view -> chooseServer());
        layout.addView(settings, new LinearLayout.LayoutParams(-1, -2));
        layout.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        root.addView(layout);
        if (server.isEmpty()) chooseServer();
    }

    private void chooseServer() {
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setSingleLine(true);
        input.setHint("http://192.168.0.5:3001");
        input.setText(getPreferences(MODE_PRIVATE).getString("testServer", ""));
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("테스트할 PC 연결")
            .setMessage("PC에서 Geuncha Mobile Test를 실행한 뒤 표시되는 PHONE URL 또는 SCREEN TEST URL을 입력하세요. 같은 Wi-Fi에 연결해야 합니다.")
            .setView(input).setNegativeButton("취소", null).setPositiveButton("연결", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            try {
                URI url = new URI(input.getText().toString().trim());
                if (!("http".equals(url.getScheme()) || "https".equals(url.getScheme())) || url.getHost() == null || url.getUserInfo() != null || url.getQuery() != null || url.getFragment() != null ||
                    !(url.getPath().isEmpty() || "/".equals(url.getPath()) || "/mobile-test".equals(url.getPath())))
                    throw new IllegalArgumentException();
                String origin = new URI(url.getScheme(), null, url.getHost(), url.getPort(), null, null, null).toString();
                getPreferences(MODE_PRIVATE).edit().putString("testServer", origin).apply();
                dialog.dismiss();
                recreate();
            } catch (Exception error) {
                input.setError("PC에 표시된 http://주소:포트 형식으로 입력하세요.");
            }
        }));
        dialog.show();
    }
}
