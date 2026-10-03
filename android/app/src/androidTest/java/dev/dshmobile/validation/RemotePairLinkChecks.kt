package dev.dshmobile.validation

import java.net.URLEncoder

/** 固定无效 key，只核验解析边界，不生成身份或访问网关。 */
object RemotePairLinkChecks {
    fun run() {
        val fragment = "key=" + "A".repeat(43)
        val http = "http://127.0.0.1:8787/pair#$fragment"
        check(RemotePairLink.parse(http)?.canonical == http)
        val custom = "dshm://pair?server=" + URLEncoder.encode("http://127.0.0.1:8787", "UTF-8") + "#$fragment"
        check(RemotePairLink.parse(custom)?.canonical == http)
        check(RemotePairLink.parse("https://example.com/pair#$fragment")?.origin == "https://example.com")
        check(RemotePairLink.parse("http://[::1]:8787/pair#$fragment")?.origin == "http://[::1]:8787")
        listOf("https://user:pass@example.com/pair#$fragment", "file:///pair#$fragment", "https://example.com/p%61ir#$fragment",
            "https://example.com/pair?key=x#$fragment", "https://example.com:70000/pair#$fragment", "https://example.com:0/pair#$fragment",
            "https://example.com/pair#key=short", " $http", "$http\n", "$http&x=1", "dshm://other?server=http%3A%2F%2Fexample.com#$fragment",
            "dshm://pair/path?server=http%3A%2F%2Fexample.com#$fragment", "dshm://pair?server=%#$fragment",
            "dshm://pair?server=http%3A%2F%2Fexample.com%2Fprivate#$fragment", "$custom&server=x",
            custom.replace("#$fragment", "&server=https%3A%2F%2Fother.com#$fragment"),
            "dshm://user@pair?server=http%3A%2F%2Fexample.com#$fragment", "dshm://pair?server=http%3A%2F%2Fexample.com%23x#$fragment"
        ).forEach { check(RemotePairLink.parse(it) == null) }
        val link = checkNotNull(RemotePairLink.parse(http))
        val old = RemotePairHandoff.offer(link)
        val current = RemotePairHandoff.offer(link)
        check(RemotePairHandoff.take(old) == null)
        check(RemotePairHandoff.take("unknown") == null)
        check(RemotePairHandoff.take(current) == http)
        check(RemotePairHandoff.take(current) == null)
    }
}
