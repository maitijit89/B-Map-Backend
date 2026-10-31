import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/core/config/env.config';
import { placeRatingService } from '../src/modules/places/place-rating.service';
import { placeService } from '../src/modules/places/place.service';

async function runPlaceRatingTestSuite() {
  console.log('========================================================================');
  console.log('⭐ B-MAP PLACE RATING & MULTI-ASPECT REVIEW SYSTEM TEST SUITE');
  console.log('========================================================================\n');

  const app = createApp();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  const testPlaceId = 'poi_cyber_hub_01';
  const prefix = env.API_PREFIX;

  // --- 1. Service Layer & Pre-seeded Reviews ---
  console.log('--- 1. Service Layer & Seed Data Verification ---');

  const initialList = await placeRatingService.getPlaceRatings(testPlaceId);
  assert(
    initialList.total >= 3,
    'CyberHub pre-seeded default reviews are loaded in dual-tier registry',
    `Found ${initialList.total} initial reviews`
  );

  const statsInitial = await placeRatingService.getPlaceRatingStats(testPlaceId);
  assert(
    statsInitial.averageRating >= 4.0 && statsInitial.averageRating <= 5.0,
    'Aggregated average rating is calculated correctly for seeded reviews',
    `Average: ${statsInitial.averageRating} / 5.0`
  );
  assert(
    statsInitial.sentimentAnalysis.sentiment === 'overwhelmingly_positive' || statsInitial.sentimentAnalysis.sentiment === 'positive',
    'Sentiment analysis engine categorizes positive reviews correctly',
    `Sentiment: ${statsInitial.sentimentAnalysis.sentiment}`
  );
  assert(
    statsInitial.aspectAverages.cleanliness >= 4.0 && statsInitial.aspectAverages.accessibility >= 4.0,
    'Aspect averages (cleanliness, accessibility) calculated properly',
    `Cleanliness: ${statsInitial.aspectAverages.cleanliness}, Accessibility: ${statsInitial.aspectAverages.accessibility}`
  );

  // --- 2. REST API: Input Validation & Error Handling ---
  console.log('\n--- 2. REST API: Input Validation & Error Handling ---');

  const invalidScoreRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({ score: 6 });

  assert(
    invalidScoreRes.status === 400,
    'Rejects rating score > 5 with HTTP 400 Bad Request',
    `Status: ${invalidScoreRes.status}`
  );

  const missingScoreRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({ title: 'Nice place' });

  assert(
    missingScoreRes.status === 400,
    'Rejects rating submission missing score with HTTP 400 Bad Request',
    `Message: ${missingScoreRes.body.message}`
  );

  // --- 3. REST API: Rating Submission & Geodesic Verified Visit Detection ---
  console.log('\n--- 3. Rating Submission & Geodesic Verified Visit Badge ---');

  // Submit verified review (within 100m of CyberHub [77.0885, 28.4955])
  const verifiedUserCoord = [77.0886, 28.4956];
  const submitVerifiedRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({
      userId: 'usr_test_traveler_101',
      userName: 'Kavita Menon',
      userEmail: 'kavita.menon@example.com',
      score: 4.8,
      title: 'Sensational pedestrian mall with seamless wheelchair access',
      review: 'Visited for Sunday brunch with my grandparents. Wide smooth ramps, direct bridge from Rapid Metro, and spotless restrooms.',
      aspects: {
        cleanliness: 5,
        accessibility: 5,
        hospitality: 5,
        valueForMoney: 4,
        amenities: 5,
      },
      visitType: 'family',
      tags: ['wheelchair_friendly', 'clean_restrooms', 'metro_connected', 'spacious'],
      userCoordinate: verifiedUserCoord,
    });

  assert(
    submitVerifiedRes.status === 201,
    'Successfully submits new place review via POST /places/:placeId/ratings',
    `Status: ${submitVerifiedRes.status}`
  );
  assert(
    submitVerifiedRes.body.data.isVerifiedVisit === true,
    'Geodesic proximity detection badges review as isVerifiedVisit = true (distance <= 250m)',
    `isVerifiedVisit: ${submitVerifiedRes.body.data.isVerifiedVisit}`
  );
  assert(
    submitVerifiedRes.body.data.score === 4.8,
    'Maintains precise fractional score rating',
    `Score: ${submitVerifiedRes.body.data.score}`
  );

  // Submit unverified review (user coordinate far away: Connaught Place ~22km away)
  const distantUserCoord = [77.2185, 28.6328];
  const submitUnverifiedRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({
      userId: 'usr_remote_reviewer_202',
      userName: 'Remote Observer',
      score: 3.5,
      title: 'Review from afar',
      review: 'Writing this before heading out.',
      userCoordinate: distantUserCoord,
    });

  assert(
    submitUnverifiedRes.body.data.isVerifiedVisit === false,
    'Rejects verified badge when user coordinate is far from POI without PoP signature',
    `isVerifiedVisit: ${submitUnverifiedRes.body.data.isVerifiedVisit}`
  );

  // Submit review with Proof-of-Presence signature
  const submitPopRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({
      userId: 'usr_pop_user_303',
      userName: 'NFC Badge Visitor',
      score: 5.0,
      title: 'NFC Tap Verified at CyberHub Entry',
      review: 'Scanned kiosk token at entry gate.',
      proofOfPresenceSignature: 'sig_bmap_nfc_ed25519_verified_token_8892',
    });

  assert(
    submitPopRes.body.data.isVerifiedVisit === true,
    'Proof-of-Presence signature automatically grants isVerifiedVisit = true badge',
    `isVerifiedVisit: ${submitPopRes.body.data.isVerifiedVisit}`
  );

  // --- 4. User Upsert Policy (1 Rating per User per Place) ---
  console.log('\n--- 4. One Review per User Upsert Policy ---');

  const initialCount = (await placeRatingService.getPlaceRatings(testPlaceId)).total;
  const updateReviewRes = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings`)
    .send({
      userId: 'usr_test_traveler_101',
      score: 5.0,
      title: 'Updated: Even better on second visit!',
      review: 'Added a star for exceptional EV fast charging speeds at Statiq stations.',
    });

  const updatedCount = (await placeRatingService.getPlaceRatings(testPlaceId)).total;
  assert(
    updatedCount === initialCount,
    'Subsequent review submission by same user updates existing record without duplicate',
    `Count remained ${updatedCount}`
  );
  assert(
    updateReviewRes.body.data.score === 5.0 && updateReviewRes.body.data.title.includes('Updated'),
    'Existing review correctly updated with new score and title',
    `New Score: ${updateReviewRes.body.data.score}`
  );

  // --- 5. User Specific Review Lookup ---
  console.log('\n--- 5. User Specific Review Lookup ---');

  const myReviewRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings/my-review?userId=usr_test_traveler_101`);

  assert(
    myReviewRes.status === 200,
    'Fetches user specific review via GET /places/:placeId/ratings/my-review',
    `Status: ${myReviewRes.status}`
  );
  assert(
    myReviewRes.body.data.userId === 'usr_test_traveler_101',
    'Matches requested user ID',
    `User: ${myReviewRes.body.data.userName}`
  );

  const missingReviewRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings/my-review?userId=usr_non_existent`);

  assert(
    missingReviewRes.status === 404,
    'Returns HTTP 404 Not Found when user has not reviewed place',
    `Status: ${missingReviewRes.status}`
  );

  // --- 6. Paginated Retrieval, Filtering & Sorting ---
  console.log('\n--- 6. Paginated Reviews Retrieval, Filtering & Sorting ---');

  // Filter verified only
  const verifiedOnlyRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings?verifiedOnly=true`);

  assert(
    verifiedOnlyRes.status === 200 && verifiedOnlyRes.body.data.every((r: any) => r.isVerifiedVisit === true),
    'Filters reviews strictly by verifiedOnly=true',
    `Returned ${verifiedOnlyRes.body.data.length} verified reviews`
  );

  // Sort by most helpful
  const helpfulSortedRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings?sortBy=most_helpful`);

  const votes = helpfulSortedRes.body.data.map((r: any) => r.helpfulVotes);
  const isSortedHelpful = votes.slice(1).every((v: number, i: number) => v <= votes[i]);
  assert(
    isSortedHelpful,
    'Sorts reviews in descending order by helpfulVotes (sortBy=most_helpful)',
    `Vote order: [${votes.join(', ')}]`
  );

  // Filter minScore
  const highRatingRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings?minScore=5`);

  assert(
    highRatingRes.body.data.every((r: any) => r.score >= 5),
    'Filters reviews by minScore >= 5',
    `Found ${highRatingRes.body.data.length} 5-star reviews`
  );

  // --- 7. Aggregated Rating Summary, Distribution & Aspect Breakdown ---
  console.log('\n--- 7. Aggregated Rating Summary, Star Distribution & Aspects ---');

  const summaryRes = await request(app)
    .get(`${prefix}/places/${testPlaceId}/ratings/summary`);

  assert(
    summaryRes.status === 200,
    'Fetches place rating summary via GET /places/:placeId/ratings/summary',
    `Status: ${summaryRes.status}`
  );
  assert(
    typeof summaryRes.body.data.averageRating === 'number',
    'Provides numeric average rating score',
    `Score: ${summaryRes.body.data.averageRating}`
  );
  assert(
    summaryRes.body.data.ratingDistribution && summaryRes.body.data.ratingDistribution[5] > 0,
    'Calculates star rating distribution (1 to 5 stars)',
    `5-star count: ${summaryRes.body.data.ratingDistribution[5]}`
  );
  assert(
    summaryRes.body.data.aspectAverages && typeof summaryRes.body.data.aspectAverages.cleanliness === 'number',
    'Calculates granular aspect averages (cleanliness, accessibility, hospitality, etc.)',
    `Accessibility avg: ${summaryRes.body.data.aspectAverages.accessibility}`
  );
  assert(
    summaryRes.body.data.sentimentAnalysis && summaryRes.body.data.sentimentAnalysis.positivePercentage >= 70,
    'Calculates recommendation percentage and sentiment classification',
    `Recommendation: ${summaryRes.body.data.recommendationPercentage}%, Sentiment: ${summaryRes.body.data.sentimentAnalysis.sentiment}`
  );

  // --- 8. Helpful Voting Mechanism (Upvote / Toggle) ---
  console.log('\n--- 8. Helpful Voting Mechanism (Upvote / Toggle) ---');

  const testReviewId = submitVerifiedRes.body.data.id;
  const voterUser = 'usr_helpful_voter_77';

  // Vote helpful
  const voteRes1 = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}/helpful`)
    .send({ userId: voterUser });

  assert(
    voteRes1.status === 200 && voteRes1.body.data.voted === true && voteRes1.body.data.helpfulVotes === 1,
    'Upvotes review as helpful and increments vote count',
    `Votes: ${voteRes1.body.data.helpfulVotes}, Voted: ${voteRes1.body.data.voted}`
  );

  // Vote again (toggle off)
  const voteRes2 = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}/helpful`)
    .send({ userId: voterUser });

  assert(
    voteRes2.status === 200 && voteRes2.body.data.voted === false && voteRes2.body.data.helpfulVotes === 0,
    'Toggles off helpful vote on second click (idempotent toggle)',
    `Votes: ${voteRes2.body.data.helpfulVotes}, Voted: ${voteRes2.body.data.voted}`
  );

  // --- 9. Abuse Reporting & Moderation Queue ---
  console.log('\n--- 9. Abuse Reporting & Automatic Moderation Flagging ---');

  // Report 1
  const rep1 = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}/report`)
    .send({ reason: 'Suspected promotional spam' });

  assert(
    rep1.body.data.reportCount === 1 && rep1.body.data.isFlagged === false,
    'Records report and increments review reportCount',
    `Count: ${rep1.body.data.reportCount}`
  );

  // Report 2
  await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}/report`)
    .send({ reason: 'Spam report 2' });

  // Report 3 (exceeds threshold)
  const rep3 = await request(app)
    .post(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}/report`)
    .send({ reason: 'Spam report 3' });

  assert(
    rep3.body.data.isFlagged === true && rep3.body.data.reportCount >= 3,
    'Flags review and transfers to moderation queue when reportCount >= 3',
    `isFlagged: ${rep3.body.data.isFlagged}, Report count: ${rep3.body.data.reportCount}`
  );

  // --- 10. Review Deletion ---
  console.log('\n--- 10. Review Deletion (Author & Admin Authorization) ---');

  // Unauthorized deletion attempt
  const unauthDel = await request(app)
    .delete(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}?userId=usr_intruder`);

  assert(
    unauthDel.status === 404,
    'Blocks deletion when requester is not review author or admin',
    `Status: ${unauthDel.status}`
  );

  // Authorized deletion by author
  const authDel = await request(app)
    .delete(`${prefix}/places/${testPlaceId}/ratings/${testReviewId}?userId=usr_test_traveler_101`);

  assert(
    authDel.status === 200 && authDel.body.data.deleted === true,
    'Author successfully deletes their own review',
    `Deleted: ${authDel.body.data.deleted}`
  );

  // --- 11. Top-Rated Places Discovery ---
  console.log('\n--- 11. Top-Rated Places Discovery ---');

  const topRatedRes = await request(app)
    .get(`${prefix}/places/top-rated/discover?limit=5`);

  assert(
    topRatedRes.status === 200,
    'Fetches top-rated places via GET /places/top-rated/discover',
    `Status: ${topRatedRes.status}`
  );
  assert(
    Array.isArray(topRatedRes.body.data) && topRatedRes.body.data.length > 0,
    'Returns top-rated POIs with ratings',
    `Received ${topRatedRes.body.data.length} places`
  );

  // --- 12. Cross-Mounted Route Aliases (/api/v1/ratings/places/:placeId) ---
  console.log('\n--- 12. Cross-Mounted Route Aliases (/api/v1/ratings/places/:placeId) ---');

  const aliasSummaryRes = await request(app)
    .get(`${prefix}/ratings/places/${testPlaceId}/summary`);

  assert(
    aliasSummaryRes.status === 200 && aliasSummaryRes.body.data.placeId === testPlaceId,
    'Cross-mounted alias GET /ratings/places/:placeId/summary functions identically',
    `Average rating: ${aliasSummaryRes.body.data.averageRating}`
  );

  const aliasListRes = await request(app)
    .get(`${prefix}/ratings/places/${testPlaceId}?limit=5`);

  assert(
    aliasListRes.status === 200 && Array.isArray(aliasListRes.body.data),
    'Cross-mounted alias GET /ratings/places/:placeId returns place reviews list',
    `Reviews count: ${aliasListRes.body.data.length}`
  );

  // --- Summary ---
  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPlaceRatingTestSuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});

