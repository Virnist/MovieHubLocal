package com.moviehub.local.tv;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private static final int REQUEST_LIBRARY_TREE = 701;
    private static final int REQUEST_VIDEO_FILES = 702;
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";

    private WebView webView;
    private String folderRequestId;
    private ValueCallback<Uri[]> fileChooserCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(9, 9, 11));
        getWindow().setNavigationBarColor(Color.rgb(9, 9, 11));
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 9, 11));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        webView.addJavascriptInterface(new MovieHubBridge(), "MovieHubAndroid");
        webView.setWebViewClient(new MovieHubWebViewClient());
        webView.setWebChromeClient(new MovieHubWebChromeClient());
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);
        setContentView(webView);
        webView.loadUrl("https://" + APP_ASSET_HOST + "/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_LIBRARY_TREE) {
            handleFolderPickerResult(resultCode, data);
        } else if (requestCode == REQUEST_VIDEO_FILES) {
            handleFilePickerResult(resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void handleFolderPickerResult(int resultCode, Intent data) {
        if (folderRequestId == null) return;
        String requestId = folderRequestId;
        folderRequestId = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            sendFolderResult(requestId, null);
            return;
        }

        Uri treeUri = data.getData();
        int grantFlags = data.getFlags()
                & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContentResolver().takePersistableUriPermission(treeUri, grantFlags);
            JSONObject result = readSelectedFolder(treeUri);
            sendFolderResult(requestId, result);
        } catch (Exception error) {
            JSONObject failure = new JSONObject();
            try {
                failure.put("error", error.getMessage() == null
                        ? "Could not access the selected USB folder."
                        : error.getMessage());
            } catch (JSONException ignored) {
                // The literal fallback below reports the error if JSON construction fails.
            }
            sendFolderResult(requestId, failure);
        }
    }

    private JSONObject readSelectedFolder(Uri treeUri) throws Exception {
        String rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocumentId);
        String folderName = queryDisplayName(rootDocumentUri);
        JSONArray files = new JSONArray();
        collectFiles(treeUri, rootDocumentId, "", files, 0);

        JSONObject result = new JSONObject();
        result.put("folderName", folderName);
        result.put("files", files);
        return result;
    }

    private String queryDisplayName(Uri documentUri) throws Exception {
        try (Cursor cursor = getContentResolver().query(
                documentUri,
                new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},
                null,
                null,
                null
        )) {
            if (cursor == null || !cursor.moveToFirst()) {
                throw new IOException("Android could not read the selected folder.");
            }
            return cursor.getString(0);
        }
    }

    private void collectFiles(
            Uri treeUri,
            String documentId,
            String parentPath,
            JSONArray files,
            int depth
    ) throws Exception {
        if (depth > 64) throw new IOException("The selected folder contains too many nested directories.");
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId);
        String[] columns = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE
        };
        try (Cursor cursor = getContentResolver().query(childrenUri, columns, null, null, null)) {
            if (cursor == null) throw new IOException("Android could not list the selected folder.");
            while (cursor.moveToNext()) {
                String childId = cursor.getString(0);
                String name = cursor.getString(1);
                String mimeType = cursor.getString(2);
                String relativePath = parentPath.isEmpty() ? name : parentPath + "/" + name;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType)) {
                    collectFiles(treeUri, childId, relativePath, files, depth + 1);
                } else {
                    JSONObject file = new JSONObject();
                    file.put("name", name);
                    file.put("relativePath", relativePath);
                    file.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                    file.put(
                            "uri",
                            DocumentsContract.buildDocumentUriUsingTree(treeUri, childId).toString()
                    );
                    files.put(file);
                }
            }
        }
    }

    private void sendFolderResult(String requestId, JSONObject result) {
        if (webView == null) return;
        String safeRequestId = JSONObject.quote(requestId);
        String safeResult = JSONObject.quote(result == null ? "null" : result.toString());
        webView.post(() -> webView.evaluateJavascript(
                "window.onMovieHubFolderSelected&&window.onMovieHubFolderSelected("
                        + safeRequestId + "," + safeResult + ");",
                null
        ));
    }

    private void handleFilePickerResult(int resultCode, Intent data) {
        if (fileChooserCallback == null) return;
        Uri[] selected = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                ClipData clip = data.getClipData();
                selected = new Uri[clip.getItemCount()];
                for (int index = 0; index < clip.getItemCount(); index++) {
                    selected[index] = clip.getItemAt(index).getUri();
                }
            } else if (data.getData() != null) {
                selected = new Uri[]{data.getData()};
            }
        }
        fileChooserCallback.onReceiveValue(selected);
        fileChooserCallback = null;
    }

    private final class MovieHubBridge {
        @JavascriptInterface
        public void requestFolderSelection(String requestId) {
            runOnUiThread(() -> {
                folderRequestId = requestId;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
                );
                try {
                    startActivityForResult(intent, REQUEST_LIBRARY_TREE);
                } catch (ActivityNotFoundException error) {
                    folderRequestId = null;
                    JSONObject failure = new JSONObject();
                    try {
                        failure.put("error", "No Android file picker is available on this TV.");
                    } catch (JSONException ignored) {
                        // Keep the user-facing error explicit if JSON construction fails.
                    }
                    sendFolderResult(requestId, failure);
                }
            });
        }
    }

    private final class MovieHubWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams fileChooserParams
        ) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = callback;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("video/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(intent, REQUEST_VIDEO_FILES);
            } catch (ActivityNotFoundException error) {
                fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = null;
            }
            return true;
        }
    }

    private final class MovieHubWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (APP_ASSET_HOST.equals(uri.getHost())) return false;
            if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // Keep the app open when the TV has no browser for external links.
                }
            }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!APP_ASSET_HOST.equals(uri.getHost())) return super.shouldInterceptRequest(view, request);
            String path = uri.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            String assetPath = "www/" + path.substring(1);
            try {
                String mimeType = getMimeType(assetPath);
                return new WebResourceResponse(mimeType, null, getAssets().open(assetPath));
            } catch (IOException ignored) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                        new HashMap<>(), null);
            }
        }

        private String getMimeType(String path) {
            String extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            Map<String, String> types = new HashMap<>();
            types.put("html", "text/html");
            types.put("js", "application/javascript");
            types.put("css", "text/css");
            types.put("json", "application/json");
            types.put("webmanifest", "application/manifest+json");
            types.put("svg", "image/svg+xml");
            types.put("png", "image/png");
            types.put("jpg", "image/jpeg");
            types.put("jpeg", "image/jpeg");
            types.put("webp", "image/webp");
            types.put("woff", "font/woff");
            types.put("woff2", "font/woff2");
            types.put("map", "application/json");
            return types.containsKey(extension) ? types.get(extension) : "application/octet-stream";
        }
    }
}
