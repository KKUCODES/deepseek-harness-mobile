package dev.dshmobile.validation;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.provider.OpenableColumns;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/** 独立测试 APK 接收器不联网；用 Java 避免依赖只存在于被测 App 的 Kotlin runtime。 */
public class RemoteShareReceiver extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        new Thread(() -> {
            JSONObject result = new JSONObject();
            try {
                result.put("uid", Process.myUid());
                Uri uri = getIntent().getParcelableExtra(Intent.EXTRA_STREAM);
                if (uri == null || !"content".equals(uri.getScheme()) || !"dev.dshmobile.validation.remote.files".equals(uri.getAuthority())) throw new IllegalArgumentException();
                result.put("scheme", uri.getScheme()).put("type", getIntent().getType()).put("flags", getIntent().getFlags());
                try (Cursor cursor = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException();
                    result.put("name", cursor.getString(0));
                }
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long size = 0;
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    byte[] buffer = new byte[65536];
                    int count;
                    while ((count = input.read(buffer)) >= 0) { digest.update(buffer, 0, count); size += count; }
                }
                StringBuilder hash = new StringBuilder();
                for (byte value : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", value & 255));
                result.put("bytes", size).put("sha256", hash.toString());
                boolean writeRejected = false;
                try { getContentResolver().openFileDescriptor(uri, "rw").close(); }
                catch (SecurityException expected) { writeRejected = true; }
                result.put("writeRejected", writeRejected);
                boolean unrelatedRejected = false;
                Uri unrelated = uri.buildUpon().path("/shared/not-granted/unrelated.txt").build();
                try { getContentResolver().openInputStream(unrelated).close(); }
                catch (SecurityException expected) { unrelatedRejected = true; }
                result.put("unrelatedRejected", unrelatedRejected);
            } catch (Exception error) {
                try { result.put("error", error.getClass().getSimpleName()); } catch (Exception ignored) { }
            }
            try (FileOutputStream output = new FileOutputStream(new File(getFilesDir(), "remote-share-result.json"))) {
                output.write(result.toString().getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) { }
            runOnUiThread(this::finish);
        }).start();
    }
}
