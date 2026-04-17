package com.boomboom.movie;

import android.app.Activity;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {

    private static final String SITE_URL = "https://boomboommovie.live/tv/";
    private WebView webView;
    private FrameLayout errorView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Plein écran, pas de barre de titre
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        errorView = findViewById(R.id.error_view);

        setupWebView();

        if (isNetworkAvailable()) {
            webView.loadUrl(SITE_URL);
        } else {
            showError();
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // JavaScript et DOM Storage (Firebase en a besoin)
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // Cache pour performance
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Media
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowContentAccess(true);

        // Viewport
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // User-Agent : ajouter "AndroidTV" pour que tv-nav.js détecte la TV
        String ua = settings.getUserAgentString();
        settings.setUserAgentString(ua + " AndroidTV BoomBoomMovie/1.0");

        // Cookies (Firebase Auth)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // WebViewClient — rester dans l'app
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Garder la navigation interne dans le WebView
                if (url.contains("boomboommovie.live")) {
                    return false; // Charger dans le WebView
                }
                // YouTube trailers, etc. — ouvrir aussi dans le WebView
                if (url.contains("youtube.com") || url.contains("youtu.be")) {
                    return false;
                }
                // Firebase Auth URLs
                if (url.contains("googleapis.com") || url.contains("gstatic.com") || url.contains("firebaseapp.com")) {
                    return false;
                }
                return false; // Par défaut, tout charger dans le WebView
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Assure que la WebView garde le focus pour recevoir les D-pad events
                webView.requestFocus();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl.equals(SITE_URL)) {
                    showError();
                }
            }
        });

        // WebChromeClient — vidéo plein écran
        webView.setWebChromeClient(new WebChromeClient() {
            private View customView;
            private CustomViewCallback customViewCallback;

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                customView = view;
                customViewCallback = callback;
                webView.setVisibility(View.GONE);
                FrameLayout container = findViewById(R.id.fullscreen_container);
                container.addView(view);
                container.setVisibility(View.VISIBLE);
            }

            @Override
            public void onHideCustomView() {
                if (customView != null) {
                    FrameLayout container = findViewById(R.id.fullscreen_container);
                    container.removeView(customView);
                    container.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                    if (customViewCallback != null) {
                        customViewCallback.onCustomViewHidden();
                    }
                    customView = null;
                }
            }
        });

        // Background noir pour éviter le flash blanc
        webView.setBackgroundColor(Color.parseColor("#0a0a0f"));

        // Focus pour recevoir les keyevents
        webView.requestFocus();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Bouton retour de la télécommande
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            }
            // Sinon, quitter l'app
            return super.onKeyDown(keyCode, event);
        }
        return super.onKeyDown(keyCode, event);
    }

    /**
     * Pont D-pad → JS KeyboardEvent.
     * Sur les vieilles WebView (projecteurs Android bas de gamme type Toptro, vieux Android 9
     * sans Play Store / WebView pas à jour), les KEYCODE_DPAD_* ne sont pas traduits en
     * ArrowUp/Down/Left/Right côté JS. On les injecte manuellement.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (webView == null || webView.getVisibility() != View.VISIBLE) {
            return super.dispatchKeyEvent(event);
        }

        String jsKey = null;
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP:    jsKey = "ArrowUp"; break;
            case KeyEvent.KEYCODE_DPAD_DOWN:  jsKey = "ArrowDown"; break;
            case KeyEvent.KEYCODE_DPAD_LEFT:  jsKey = "ArrowLeft"; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: jsKey = "ArrowRight"; break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:      jsKey = "Enter"; break;
        }

        if (jsKey == null) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            String js =
                "(function(k){" +
                "var opts={key:k,code:k,bubbles:true,cancelable:true};" +
                "document.dispatchEvent(new KeyboardEvent('keydown',opts));" +
                "})('" + jsKey + "');";
            webView.evaluateJavascript(js, null);
        }
        return true;
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        // Ré-appliquer immersive mode
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    private void showError() {
        webView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);

        // Retry sur Enter/click
        errorView.setOnClickListener(v -> {
            if (isNetworkAvailable()) {
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                webView.loadUrl(SITE_URL);
            }
        });

        errorView.setOnKeyListener((v, keyCode, event) -> {
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                if (event.getAction() == KeyEvent.ACTION_UP && isNetworkAvailable()) {
                    errorView.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                    webView.loadUrl(SITE_URL);
                    return true;
                }
            }
            return false;
        });

        errorView.requestFocus();
    }
}
