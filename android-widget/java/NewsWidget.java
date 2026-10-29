package com.omaralyassi.realestate;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/** Home-screen widget: the latest real-estate news and the latest offer, without opening the app. */
public class NewsWidget extends AppWidgetProvider {
    private static final String FEED = "https://omaralyassirealestate.com/wp-admin/admin-ajax.php?action=oay_acc_widget";
    private static final String REFRESH = "com.omaralyassi.realestate.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        draw(ctx, mgr, ids, null, true);
        refresh(ctx, goAsync());
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (REFRESH.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            draw(ctx, mgr, mgr.getAppWidgetIds(new ComponentName(ctx, NewsWidget.class)), null, true);
            refresh(ctx, goAsync());
        }
    }

    private void refresh(final Context ctx, final PendingResult pr) {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(FEED).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(15000);
                c.setRequestProperty("User-Agent", "OmarAlYassiWidget");
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder(); String line;
                while ((line = r.readLine()) != null) sb.append(line);
                r.close();
                JSONObject j = new JSONObject(sb.toString());
                SharedPreferences.Editor e = ctx.getSharedPreferences("oay_widget", Context.MODE_PRIVATE).edit();
                e.putString("news", j.optString("news", ""));
                JSONObject o = j.optJSONObject("offer");
                e.putString("offerTitle", o != null ? o.optString("title", "") : "");
                e.putString("offerBody", o != null ? o.optString("body", "") : "");
                e.putString("offerId", o != null ? o.optString("id", "") : "");
                e.putLong("t", System.currentTimeMillis());
                e.apply();
            } catch (Exception ignored) { }
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            draw(ctx, mgr, mgr.getAppWidgetIds(new ComponentName(ctx, NewsWidget.class)), null, false);
            pr.finish();
        }).start();
    }

    private static PendingIntent open(Context ctx, String path, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("com.omaralyassi.realestate://open/" + path));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void draw(Context ctx, AppWidgetManager mgr, int[] ids, String unused, boolean loading) {
        SharedPreferences p = ctx.getSharedPreferences("oay_widget", Context.MODE_PRIVATE);
        String news = p.getString("news", ""), ot = p.getString("offerTitle", ""), ob = p.getString("offerBody", ""), oid = p.getString("offerId", "");
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_news);
            v.setTextViewText(R.id.w_news, news.isEmpty() ? (loading ? "جارِ تحميل آخر الأخبار…" : "لا توجد أخبار حالياً") : news);
            if (ot.isEmpty()) { v.setViewVisibility(R.id.w_offer_box, View.GONE); }
            else {
                v.setViewVisibility(R.id.w_offer_box, View.VISIBLE);
                v.setTextViewText(R.id.w_offer_title, ot);
                v.setTextViewText(R.id.w_offer_body, ob);
                v.setOnClickPendingIntent(R.id.w_offer_box, open(ctx, oid.matches("\\d+") ? "oland/" + oid : "land/" + Uri.encode(oid), 2));
            }
            v.setOnClickPendingIntent(R.id.w_news_box, open(ctx, "news", 1));
            v.setOnClickPendingIntent(R.id.w_logo, open(ctx, "home", 3));
            Intent ri = new Intent(ctx, NewsWidget.class); ri.setAction(REFRESH);
            v.setOnClickPendingIntent(R.id.w_refresh, PendingIntent.getBroadcast(ctx, 4, ri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            mgr.updateAppWidget(id, v);
        }
    }
}
