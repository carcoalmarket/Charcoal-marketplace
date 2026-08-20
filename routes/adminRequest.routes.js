const router = require("express").Router();

const db = require("../config/db");

const {
  verifyToken
} = require("../middleware/auth.middleware");


/* =========================================================
   GET MY ADMIN INVITATIONS

   GET /api/admin-request/invitations
========================================================= */

router.get(
  "/invitations",
  verifyToken(),
  (req, res) => {

    db.query(
      `
      UPDATE admin_invitations
      SET status = 'expired'
      WHERE invited_pi_uid = ?
      AND status = 'pending'
      AND expires_at <= NOW()
      `,
      [req.user.pi_uid],

      () => {

        db.query(
          `
          SELECT
            id,
            invited_pi_uid,
            invited_pi_username,
            admin_level,
            status,
            expires_at,
            accepted_at,
            created_at
          FROM admin_invitations
          WHERE invited_pi_uid = ?
          ORDER BY created_at DESC
          `,
          [req.user.pi_uid],

          (err, invitations) => {

            if (err) {

              console.error(
                "My invitations error:",
                err
              );

              return res.status(500).json({
                success: false,
                message:
                  "Failed to load invitations"
              });

            }


            res.json({

              success: true,

              invitations:
                invitations || []

            });

          }
        );

      }
    );

  }
);


/* =========================================================
   ACCEPT ADMIN INVITATION

   POST /api/admin-request/invitations/:id/accept
========================================================= */

router.post(
  "/invitations/:id/accept",
  verifyToken(),
  (req, res) => {

    const invitationId =
      Number(req.params.id);


    if (
      !Number.isInteger(invitationId)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid invitation ID"
      });

    }


    db.query(
      `
      SELECT
        id,
        invited_pi_uid,
        admin_level,
        status,
        expires_at
      FROM admin_invitations
      WHERE id = ?
      LIMIT 1
      `,
      [invitationId],

      (err, invitations) => {

        if (err) {

          return res.status(500).json({
            success: false,
            message:
              "Database error"
          });

        }


        if (!invitations.length) {

          return res.status(404).json({
            success: false,
            message:
              "Invitation not found"
          });

        }


        const invitation =
          invitations[0];


        /*
         * SECURITY:
         * The invitation must belong
         * to the logged-in Pi account.
         */

        if (
          String(
            invitation.invited_pi_uid
          ) !==
          String(req.user.pi_uid)
        ) {

          return res.status(403).json({
            success: false,
            message:
              "This invitation does not belong to your Pi account"
          });

        }


        if (
          invitation.status !==
          "pending"
        ) {

          return res.status(400).json({
            success: false,
            message:
              `Invitation is already ${invitation.status}`
          });

        }


        if (
          new Date(invitation.expires_at)
          <= new Date()
        ) {

          db.query(
            `
            UPDATE admin_invitations
            SET status = 'expired'
            WHERE id = ?
            `,
            [invitationId]
          );

          return res.status(400).json({
            success: false,
            message:
              "This invitation has expired"
          });

        }


        db.query(
          `
          UPDATE admin_invitations
          SET
            status = 'accepted',
            accepted_at = CURRENT_TIMESTAMP
          WHERE id = ?
          AND status = 'pending'
          `,
          [invitationId],

          (updateErr, result) => {

            if (updateErr) {

              return res.status(500).json({
                success: false,
                message:
                  "Failed to accept invitation"
              });

            }


            if (
              result.affectedRows === 0
            ) {

              return res.status(409).json({
                success: false,
                message:
                  "Invitation has already been processed"
              });

            }


            res.json({

              success: true,

              message:
                "Invitation accepted. You may now request administrator access.",

              invitation: {
                id: invitation.id,
                admin_level:
                  invitation.admin_level,
                status: "accepted"
              }

            });

          }
        );

      }
    );

  }
);


/* =========================================================
   REQUEST ADMIN ACCESS

   POST /api/admin-request/request
========================================================= */

router.post(
  "/request",
  verifyToken(),
  (req, res) => {

    const requestedLevel =
      req.body &&
      req.body.admin_level === "moderator"
        ? "moderator"
        : "admin";


    /*
     * Never allow an existing admin
     * to create another request.
     */

    if (
      req.user.role === "admin"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "You are already an administrator"
      });

    }


    /*
     * Find an ACCEPTED invitation
     * belonging to this exact Pi account.
     */

    db.query(
      `
      SELECT
        id,
        admin_level,
        status
      FROM admin_invitations
      WHERE invited_pi_uid = ?
      AND status = 'accepted'
      AND admin_level = ?
      ORDER BY accepted_at DESC
      LIMIT 1
      `,
      [
        req.user.pi_uid,
        requestedLevel
      ],

      (err, invitations) => {

        if (err) {

          console.error(err);

          return res.status(500).json({
            success: false,
            message:
              "Failed to verify administrator invitation"
          });

        }


        if (!invitations.length) {

          return res.status(403).json({
            success: false,
            message:
              "You cannot request administrator access because you have not accepted a valid invitation from the Super Admin."
          });

        }


        const invitation =
          invitations[0];


        /*
         * Check existing request.
         */

        db.query(
          `
          SELECT
            id,
            status
          FROM admin_requests
          WHERE requested_by = ?
          AND status IN ('pending', 'approved')
          LIMIT 1
          `,
          [req.user.id],

          (requestErr, existingRequests) => {

            if (requestErr) {

              return res.status(500).json({
                success: false,
                message:
                  "Failed to check existing request"
              });

            }


            if (
              existingRequests.length
            ) {

              return res.status(409).json({
                success: false,
                message:
                  "You already have an administrator request"
              });

            }


            /*
             * Create request linked
             * directly to invitation.
             */

            db.query(
              `
              INSERT INTO admin_requests
              (
                requested_by,
                pi_username,
                pi_uid,
                admin_level,
                status,
                invitation_id
              )
              VALUES (?, ?, ?, ?, 'pending', ?)
              `,
              [
                req.user.id,
                req.user.pi_username,
                req.user.pi_uid,
                requestedLevel,
                invitation.id
              ],

              (insertErr, result) => {

                if (insertErr) {

                  console.error(
                    "Admin request creation error:",
                    insertErr
                  );

                  return res.status(500).json({
                    success: false,
                    message:
                      "Failed to create administrator request"
                  });

                }


                res.status(201).json({

                  success: true,

                  message:
                    "Administrator request submitted successfully. The Super Admin will review it.",

                  request_id:
                    result.insertId

                });

              }
            );

          }
        );

      }
    );

  }
);


module.exports = router;