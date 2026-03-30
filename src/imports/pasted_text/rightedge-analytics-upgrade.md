Upgrade the RightEdge admin dashboard so I can properly track real user analytics and know whether Reddit / Discord activity is turning into actual visitors and subscribers.

IMPORTANT:
Right now I only have basic page hit counts. I cannot tell:
- whether traffic is me or real external users
- where users came from
- how many unique visitors I have
- what pages they viewed
- whether they clicked unlock or subscribed

I want a clean, reliable analytics system built directly into the existing RightEdge project and admin panel.

BUILD THIS:

1. Track every visit and important event
Create a traffic / analytics events system that logs:
- timestamp
- page path
- full URL
- referrer
- utm_source
- utm_medium
- utm_campaign
- visitor_id
- session_id
- device type
- user_agent
- is_internal
- is_subscriber if known

Also track these events:
- homepage_view
- predictions_view
- results_view
- methodology_view
- paywall_view
- unlock_click
- checkout_start
- subscription_success
- login_start
- login_success

2. Unique visitor tracking
Generate and persist:
- visitor_id in localStorage for anonymous users
- session_id for each browsing session

I want to distinguish:
- total pageviews
- unique visitors
- sessions

3. Exclude my own traffic
I need a clear way to stop my own visits polluting analytics.

Implement:
- if logged-in email is elliott@woodbry.com or ewoodbry@gmail.com, mark traffic as is_internal = true
- support a localStorage flag like rightedge_internal_traffic = true
- exclude admin page visits from customer analytics
- add an admin toggle to show:
  - external traffic only
  - all traffic including internal

4. Capture acquisition source properly
Track and store UTM parameters from URLs like:
- ?utm_source=reddit
- ?utm_medium=comment
- ?utm_campaign=first10

If no UTM exists, try to classify source as:
- direct
- reddit
- discord
- x
- google
- referral
- unknown

5. Build a much better analytics dashboard in admin
Replace the current basic recent traffic list with a proper analytics section.

I want these sections:

A. OVERVIEW CARDS
- pageviews today
- unique visitors today
- sessions today
- external visitors today
- unlock clicks today
- checkout starts today
- subscription conversions today
- conversion rate today

B. TIME FILTERS
- today
- last 7 days
- last 30 days

C. TRAFFIC BY SOURCE
For each source show:
- unique visitors
- sessions
- pageviews
- unlock clicks
- conversions

D. TRAFFIC BY CAMPAIGN
For each utm_campaign show:
- visitors
- pageviews
- unlock clicks
- checkout starts
- conversions

E. TOP LANDING PAGES
Show which pages users first landed on.

F. CONVERSION FUNNEL
Show:
- homepage visits
- predictions views
- paywall views
- unlock clicks
- checkout starts
- successful subscriptions

G. RECENT EXTERNAL VISITS
Show a recent feed with:
- time
- source
- page
- device
- subscriber or not

6. Add charts
Add charts for:
- daily pageviews
- daily unique visitors
- traffic by source
- conversion funnel
- subscriptions over time

Keep the current RightEdge dark neon admin design style.

7. Backend / data storage
Create whatever Supabase tables and logic are needed for this to work properly.
Use clean, lightweight event logging.

I expect something like:
- traffic_events table
- analytics_events table if needed

8. Important logic rules
- do not inflate counts from constant refreshes
- allow real navigation between pages to count properly
- internal traffic must be easy to exclude
- admin page activity should not be treated as customer behaviour
- this should be reliable and practical, not over-engineered

9. Final result I want
When I open admin, I want to clearly see:
- how many real external visitors I had
- whether Reddit or Discord drove traffic
- which campaign caused visits
- how many people hit the paywall
- how many clicked unlock
- how many actually subscribed

Please implement this directly in the project and preserve the current RightEdge design language.