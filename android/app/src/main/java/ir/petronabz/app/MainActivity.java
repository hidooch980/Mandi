package ir.petronabz.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String PREFS_NAME = "petronabz_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout errorOverlay;
    private TextView errorDetailsView;
    private ValueCallback<Uri[]> filePathCallback;
    private String currentServerUrl;
    private boolean updateCheckedOnce = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        currentServerUrl = prefs.getString(KEY_SERVER_URL, BuildConfig.DEFAULT_SERVER_URL);
        if (currentServerUrl == null || currentServerUrl.trim().isEmpty()
                || "http://192.168.100.60:3000".equals(currentServerUrl)) {
            currentServerUrl = BuildConfig.DEFAULT_SERVER_URL;
            prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0F172A"));

        webView = new WebView(this);
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 10);
        pbParams.gravity = Gravity.TOP;
        root.addView(progressBar, pbParams);

        errorOverlay = buildErrorOverlay();
        errorOverlay.setVisibility(View.GONE);
        root.addView(errorOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // Discreet floating settings/update button at top-left so RTL header stays clear
        Button menuBtn = buildFloatingMenuButton();
        FrameLayout.LayoutParams btnParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        btnParams.gravity = Gravity.BOTTOM | Gravity.START;
        btnParams.setMargins(28, 0, 0, 170);
        root.addView(menuBtn, btnParams);

        setContentView(root);
        loadServerUrl();
    }

    private void configureWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        ws.setSupportZoom(false);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AndroidPrintBridge(), "AndroidNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("sms:") || url.startsWith("smsto:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "برنامه پیامک یافت نشد.", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                if (url.startsWith("tel:")) {
                    startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url)));
                    return true;
                }
                if (url.endsWith(".apk")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                errorOverlay.setVisibility(View.GONE);
                // Bridge window.print() to native Android PrintManager for Proforma PDF export
                view.evaluateJavascript(
                        "(function(){if(!window.__androidPrintPatched){window.__androidPrintPatched=true;window.print=function(){if(window.AndroidNative){window.AndroidNative.printPage();}};}})();",
                        null);
                if (!updateCheckedOnce) {
                    updateCheckedOnce = true;
                    checkForUpdates(false);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showErrorState("آدرس فعلی: " + currentServerUrl);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            }
        });
    }

    private class AndroidPrintBridge {
        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager != null) {
                    PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("PetroNabz-Invoice");
                    printManager.print("سند پترونبض", adapter, new PrintAttributes.Builder().build());
                }
            });
        }
    }

    private LinearLayout buildErrorOverlay() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.parseColor("#0F172A"));
        box.setPadding(56, 56, 56, 56);

        TextView title = new TextView(this);
        title.setText("اتصال به سرور برقرار نشد");
        title.setTextColor(Color.WHITE);
        title.setTextSize(19);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        errorDetailsView = new TextView(this);
        errorDetailsView.setTextColor(Color.parseColor("#94A3B8"));
        errorDetailsView.setTextSize(13);
        errorDetailsView.setGravity(Gravity.CENTER);
        errorDetailsView.setPadding(0, 20, 0, 36);
        box.addView(errorDetailsView);

        Button retryBtn = new Button(this);
        retryBtn.setText("تلاش مجدد");
        retryBtn.setBackgroundColor(Color.parseColor("#10B981"));
        retryBtn.setTextColor(Color.parseColor("#020617"));
        retryBtn.setOnClickListener(v -> loadServerUrl());
        box.addView(retryBtn);

        Button cfgBtn = new Button(this);
        cfgBtn.setText("تغییر آدرس سرور (وای‌فای / اینترنت)");
        cfgBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        cfgBtn.setTextColor(Color.WHITE);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = 20;
        cfgBtn.setOnClickListener(v -> showServerUrlDialog());
        box.addView(cfgBtn, lp);

        return box;
    }

    private Button buildFloatingMenuButton() {
        Button btn = new Button(this);
        btn.setText("⚙ سرور | بروزرسانی");
        btn.setTextSize(11);
        btn.setTextColor(Color.WHITE);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(205, 15, 23, 42));
        bg.setCornerRadius(40);
        bg.setStroke(2, Color.parseColor("#334155"));
        btn.setBackground(bg);
        btn.setPadding(28, 12, 28, 12);
        btn.setOnClickListener(v -> showOptionsMenu());
        return btn;
    }

    private void showOptionsMenu() {
        String[] options = {
                "بارگذاری مجدد صفحه",
                "تنظیم آدرس سرور (وای‌فای یا اینترنت)",
                "بررسی بروزرسانی اپلیکیشن (نسخه فعلی: " + BuildConfig.VERSION_NAME + ")",
                "چاپ یا ذخیره PDF صفحه فعلی"
        };
        new AlertDialog.Builder(this)
                .setTitle("تنظیمات اپلیکیشن پترونبض")
                .setItems(options, (dialog, which) -> {
                    if (which == 0) {
                        webView.reload();
                    } else if (which == 1) {
                        showServerUrlDialog();
                    } else if (which == 2) {
                        checkForUpdates(true);
                    } else if (which == 3) {
                        new AndroidPrintBridge().printPage();
                    }
                })
                .show();
    }

    private void showServerUrlDialog() {
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(currentServerUrl);
        input.setHint("https://mandi-oil-web.vercel.app");

        new AlertDialog.Builder(this)
                .setTitle("آدرس سرور برنامه")
                .setMessage("آدرس اینترنتی سایت (https://...) یا آدرس وای‌فای را وارد کنید:")
                .setView(input)
                .setPositiveButton("ذخیره و اتصال", (d, w) -> {
                    String val = input.getText().toString().trim();
                    if (!val.startsWith("http://") && !val.startsWith("https://")) {
                        val = (val.startsWith("192.168.") || val.startsWith("10."))
                                ? "http://" + val
                                : "https://" + val;
                    }
                    if (val.endsWith("/")) {
                        val = val.substring(0, val.length() - 1);
                    }
                    currentServerUrl = val;
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            .edit()
                            .putString(KEY_SERVER_URL, currentServerUrl)
                            .apply();
                    loadServerUrl();
                })
                .setNegativeButton("انصراف", null)
                .show();
    }

    private void loadServerUrl() {
        errorOverlay.setVisibility(View.GONE);
        webView.loadUrl(currentServerUrl);
    }

    private void showErrorState(String details) {
        errorDetailsView.setText("خطا در اتصال به سرور. لطفاً اتصال اینترنت را بررسی کنید.\n" + details);
        errorOverlay.setVisibility(View.VISIBLE);
    }

    private void checkForUpdates(boolean notifyIfLatest) {
        new Thread(() -> {
            try {
                URL url = new URL(currentServerUrl + "/api/app-version");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(4500);
                conn.setReadTimeout(4500);
                if (conn.getResponseCode() != 200) return;

                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();

                JSONObject json = new JSONObject(sb.toString());
                int latestCode = json.optInt("versionCode", BuildConfig.VERSION_CODE);
                String latestName = json.optString("versionName", BuildConfig.VERSION_NAME);
                String apkPath = json.optString("apkUrl", "/downloads/petronabz-latest.apk");
                String notes = json.optString("releaseNotes", "");

                new Handler(Looper.getMainLooper()).post(() -> {
                    if (latestCode > BuildConfig.VERSION_CODE) {
                        String fullApkUrl = apkPath.startsWith("http")
                                ? apkPath
                                : currentServerUrl + apkPath;
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("نسخه جدید آماده است (" + latestName + ")")
                                .setMessage("نسخه جدید اپلیکیشن پترونبض منتشر شده است. با دانلود و نصب آن، برنامه بدون پاک شدن اطلاعات بروزرسانی می‌شود.\n\n" + notes)
                                .setPositiveButton("دانلود و بروزرسانی", (d, w) ->
                                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fullApkUrl))))
                                .setNegativeButton("بعداً", null)
                                .show();
                    } else if (notifyIfLatest) {
                        Toast.makeText(MainActivity.this,
                                "شما از آخرین نسخه (" + BuildConfig.VERSION_NAME + ") استفاده می‌کنید.",
                                Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception ignored) {
                if (notifyIfLatest) {
                    new Handler(Looper.getMainLooper()).post(() ->
                            Toast.makeText(MainActivity.this,
                                    "خطا در بررسی نسخه جدید از سرور.",
                                    Toast.LENGTH_SHORT).show());
                }
            }
        }).start();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
