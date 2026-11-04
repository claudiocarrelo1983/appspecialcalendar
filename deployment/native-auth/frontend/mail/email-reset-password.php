<?php

use yii\helpers\Html;

/* @var $this yii\web\View */
/* @var $user common\models\User */

//$resetLink = Yii::$app->urlManager->createAbsoluteUrl(['site/reset-password', 'token' => $user->password_reset_token]);
$resetLink = Yii::$app->urlManager->createAbsoluteUrl([$url, 'token' => $user->password_reset_token]);
if (is_string($url) && preg_match('#^/?(c[0-9]+)/reset-password$#D',$url,$match)) {
    $resetLink = \common\helpers\GymClassAppLinks::passwordResetUrl($match[1],$user->password_reset_token);
}
?>

<div>
    <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
        <tbody>
            <tr>
                <td valign="top" width="100%" dir="ltr" bgcolor="transparent" style="background-color:transparent;padding:10px 40px">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                        <tbody>
                            <tr>
                                <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                        <tbody>
                                            <tr>
                                                <td dir="ltr" valign="top" style="padding:0">
                                                    <table align="center" style="border-spacing:0;table-layout:fixed;margin:0 auto;width:33%;min-width:33%;max-width:33%;border-collapse:separate!important" width="33%">
                                                        <tbody>
                                                            <tr>
                                                                <td style="border-top:1px solid transparent"></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </th>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</div>


<tr id="m_8953706569730355704d7b35ff9-c4a3-aadf-f251-cd8b06c2fa33">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="#FFFFFF" style="background-color:rgb(255,255,255);padding:10px 40px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <td dir="ltr" valign="top" style="padding:0">
                                                            <table width="100%" id="m_8953706569730355704c16cf04a-579a-86f8-9167-0caddb2a0a75" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="font-family:&quot;Trebuchet MS&quot;;font-size:42px;color:rgb(54,70,86);text-align:center;line-height:normal;padding-top:0;padding-bottom:0">
                                                                            <p style="font-family:&quot;Trebuchet MS&quot;;font-size:27px;color:rgb(0,136,204);line-height:normal;text-align:center;word-break:break-word;overflow:hidden;margin:0 auto;padding:0">
                                                                                <?= Yii::t('app','hello') ?> <?= Html::encode($user->full_name) ?>,
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>

<tr id="m_895370656973035570418a7a6d2-0094-7067-943a-136f3fefc4bf">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="#FFFFFF" style="background-color:rgb(255,255,255);padding:20px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <td dir="ltr" valign="top" style="padding:0">
                                                            <table width="100%" id="m_89537065697303557047a173893-3c8c-1af8-4e27-f584eddd31ff" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="padding-bottom:0;padding-top:0" lang="en" dir="ltr" role="textbox" aria-label="Rich Text Editor. Editing area: main">
                                                                            <p style="font-family:&quot;Trebuchet MS&quot;;font-size:15px;color:rgb(80,80,80);line-height:200%;text-align:center;word-break:break-word;overflow:hidden;margin:0 auto;padding:0">
                                                                                <?= Yii::t('app','email_reset_message') ?>
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>

<tr id="m_8953706569730355704dce73099-8fc8-59fa-b044-c905326113ab">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="transparent" style="background-color:transparent;padding:10px 40px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <td dir="ltr" valign="top" style="padding:0">
                                                            <table cellspacing="0" cellpadding="0" border="0" class="m_8953706569730355704button" style="table-layout:fixed;margin:0 auto;width:auto;border-collapse:separate;border-spacing:0;padding-top:0;padding-bottom:0" align="center" id="m_89537065697303557042c6a87d6-2e3a-e71e-a013-f7d737cad8f3">
                                                                <tbody>
                                                                    <tr>
                                                                        <td align="center">
                                                                            <p style="border-radius:500px;border:6px solid rgb(0,136,204);text-align:center;font-family:&quot;Trebuchet MS&quot;;font-size:20px;color:rgb(255,255,255);margin:0;word-break:break-word;background:rgb(0,136,204);padding:12px 24px;display:block;text-decoration:none">
                                                                                <?= Html::a(
                                                                                    '<small style="color:#fff;text-decoration: none;text-decoration-color: #0088CC;">'.Yii::t('app','email_reset_button').'</small>',
                                                                                        $resetLink
                                                                                    ) 
                                                                                ?> 
                                                                            </p>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>
<tr id="m_89537065697303557045336839b-cad0-48ee-8857-84259d06e5c9">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="#FFFFFF" style="background-color:rgb(255,255,255);padding:10px 40px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                            <tbody>
                                                <tr>
                                                    <td dir="ltr" valign="top" style="padding:0">
                                                        <table align="center" style="border-spacing:0;table-layout:fixed;margin:0 auto;width:33%;min-width:33%;max-width:33%;border-collapse:separate!important" width="33%">
                                                            <tbody>
                                                                <tr>
                                                                    <td style="border-top:1px solid transparent"></td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>

<tr id="m_8953706569730355704d27e8833-cda2-bceb-813c-b78d04b9d004">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="#FFFFFF" style="background-color:rgb(255,255,255);padding:10px 40px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                <tbody>
                                                                    <tr>
                                                                        <td dir="ltr" valign="top" style="padding:0">
                                                                            <table width="100%" id="m_895370656973035570464e079c0-f2af-6308-a176-92bcaa803665" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                                <tbody>
                                                                                    <tr>
                                                                                        <td style="padding-top:0;padding-bottom:0">
                                                                                            <p style="font-family:&quot;Trebuchet MS&quot;;font-size:12px;color:rgb(80,80,80);line-height:200%;text-align:center;word-break:break-word;overflow:hidden;margin:0 auto;padding:0">Enviado por 
                                                                                                <a href="http://mkt.specialcalendar.com/got/a280437de7OGue4j" style="color:rgb(80,80,80);text-decoration:underline" target="_blank" data-saferedirecturl="https://www.google.com/url?q=http://mkt.specialcalendar.com/got/a280437de7OGue4j&amp;source=gmail&amp;ust=1715025452266000&amp;usg=AOvVaw2kYLIQLY2Ye7HFrlX_ULIj">noreply@specialcalendar.com</a> para 
                                                                                                <a href="http://mkt.specialcalendar.com/got/bbdf3130e7OGue19" style="color:rgb(80,80,80);text-decoration:underline" target="_blank" data-saferedirecturl="https://www.google.com/url?q=http://mkt.specialcalendar.com/got/bbdf3130e7OGue19&amp;source=gmail&amp;ust=1715025452266000&amp;usg=AOvVaw1nZO3gXgxrU6IQx1NkeCdy">clacarrl83@gmail.com</a>
                                                                                            </p>
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </th>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                <tbody>
                                                                    <tr>
                                                                        <td dir="ltr" valign="top" style="padding:0">
                                                                            <table border="0" cellpadding="0" cellspacing="0" align="center" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                                                <tbody>
                                                                                    <tr>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </th>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>
<tr id="m_89537065697303557043175af27-2829-a1d1-2dd4-04e1fa566d66">
    <td valign="top" style="font-size:0;background-color:transparent" align="center">
        <div>
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="m_8953706569730355704email-container" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:auto" align="center">
                <tbody>
                    <tr>
                        <td valign="top" width="100%" dir="ltr" bgcolor="#FFFFFF" style="background-color:rgb(255,255,255);padding:10px 40px">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                <tbody>
                                    <tr>
                                        <th valign="top" class="m_8953706569730355704stack-column-center m_8953706569730355704columns" width="100%" style="font-weight:400">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto">
                                                <tbody>
                                                    <tr>
                                                        <td dir="ltr" valign="top" style="padding:0">
                                                            <table align="center" style="border-spacing:0;table-layout:fixed;margin:0 auto;width:33%;min-width:33%;max-width:33%;border-collapse:separate!important" width="33%">
                                                                <tbody>
                                                                    <tr>
                                                                        <td style="border-top:1px solid transparent"></td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </td>
</tr>